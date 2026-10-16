from django.db import IntegrityError
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.permissions import IsFounder
from audit.exports import export_list
from core.mail import EmailNotSent

from . import services
from .filters import describe_filters, filter_applications
from .models import Application
from .serializers import (
    ALREADY_IN_PROGRESS,
    AcceptSerializer,
    ApplicationSerializer,
    ApplicationSubmitSerializer,
    RejectSerializer,
)


class ApplicationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def founders_queryset():
    return Application.objects.select_related('territory__parent__parent', 'decided_by')


class ApplicationListCreateView(generics.ListCreateAPIView):
    """Dépôt public d'une demande (POST) ; liste des demandes pour les fondateurs (GET).

    Filtres de la liste : ``status`` (un des statuts) et ``search`` (nom, prénom,
    courriel ou référence).
    """

    pagination_class = ApplicationPagination
    throttle_scope = 'adhesion'

    def get_permissions(self):
        if self.request.method == 'POST':
            return [AllowAny()]
        return [IsFounder()]

    def get_throttles(self):
        if self.request.method == 'POST':
            return [ScopedRateThrottle()]
        return []

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ApplicationSubmitSerializer
        return ApplicationSerializer

    def get_queryset(self):
        return filter_applications(founders_queryset(), self.request.query_params)

    def perform_create(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            # Deux envois simultanés avec le même courriel : la base garde le premier.
            raise ValidationError({'email': [ALREADY_IN_PROGRESS]})


class ApplicationExportView(APIView):
    """Export Excel de la liste des demandes affichée (mêmes filtres), noté dans le journal.

    La motivation et les notes, données sensibles, ne sont pas exportées.
    """

    permission_classes = [IsFounder]

    def get(self, request):
        params = request.query_params
        applications = filter_applications(founders_queryset(), params)
        rows = (
            (
                application.reference,
                application.last_name,
                application.first_name,
                application.email,
                application.territory.name,
                application.profession,
                application.get_status_display(),
                application.created_at,
                application.decided_at,
                (application.decided_by.get_full_name().strip() or application.decided_by.email)
                if application.decided_by
                else None,
            )
            for application in applications
        )
        return export_list(
            request,
            base_name='demandes',
            subject="Demandes d'adhésion",
            headers=[
                'Référence', 'Nom', 'Prénom', 'Courriel', 'Localité souhaitée', 'Profession', 'Statut',
                'Date de la demande', 'Date de la décision', 'Décidée par',
            ],
            rows=rows,
            filters=describe_filters(params),
        )


class ApplicationDetailView(generics.RetrieveAPIView):
    permission_classes = [IsFounder]
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        return founders_queryset()


class DecisionView(APIView):
    """Base des décisions : la demande doit attendre, et le courriel doit partir."""

    permission_classes = [IsFounder]

    def get_application(self, pk):
        return generics.get_object_or_404(Application, pk=pk)

    def respond(self, decide):
        try:
            application = decide()
        except services.AlreadyDecided as error:
            return Response({'detail': str(error), 'code': 'already_decided'}, status=status.HTTP_409_CONFLICT)
        except EmailNotSent:
            return Response(
                {
                    'detail': (
                        "Le courriel n'a pas pu être envoyé : la décision n'est pas enregistrée et la demande "
                        'reste « À examiner ». Réessayez dans quelques minutes.'
                    ),
                    'code': 'email_not_sent',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(ApplicationSerializer(founders_queryset().get(pk=application.pk)).data)


class AcceptView(DecisionView):
    """Acceptation d'une demande : envoi du lien personnel d'inscription."""

    def post(self, request, pk):
        application = self.get_application(pk)
        serializer = AcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.respond(
            lambda: services.accept(application, by=request.user, note=serializer.validated_data['internal_note'])
        )


class RejectView(DecisionView):
    """Refus d'une demande, avec un motif écrit envoyé à la personne."""

    def post(self, request, pk):
        application = self.get_application(pk)
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.respond(
            lambda: services.reject(
                application,
                by=request.user,
                reason=serializer.validated_data['reason'],
                note=serializer.validated_data['internal_note'],
            )
        )
