from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsFounder
from core.mail import EmailNotSent
from core.tokens import token_digest
from members.models import Member

from . import services
from .models import Application, RegistrationLink
from .serializers import (
    ALREADY_IN_PROGRESS,
    AcceptSerializer,
    ApplicationSerializer,
    ApplicationSubmitSerializer,
    FinalizeRegistrationSerializer,
    RegistrationPreviewSerializer,
    RejectSerializer,
)

LINK_ERRORS = {
    'invalid': ('Ce lien est inconnu. Vérifiez que vous avez copié toute l’adresse reçue par courriel.', 'invalid_link', status.HTTP_404_NOT_FOUND),
    'expired': ('Ce lien a expiré. Contactez le bureau du mouvement pour recevoir un nouveau lien.', 'expired_link', status.HTTP_410_GONE),
    'used': ('Ce lien a déjà été utilisé. Vous pouvez maintenant vous connecter.', 'used_link', status.HTTP_409_CONFLICT),
}


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
        queryset = founders_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            if status_filter not in Application.Status.values:
                raise ValidationError({'status': ['Statut inconnu.']})
            queryset = queryset.filter(status=status_filter)
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(reference__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            # Deux envois simultanés avec le même courriel : la base garde le premier.
            raise ValidationError({'email': [ALREADY_IN_PROGRESS]})


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


class FinalizeRegistrationView(APIView):
    """Valide le lien personnel puis crée le compte et le profil du membre."""

    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _error(self, kind):
        detail, code, http_status = LINK_ERRORS[kind]
        return Response({'detail': detail, 'code': code}, status=http_status)

    def _link(self, token, *, lock=False):
        queryset = RegistrationLink.objects.select_related('application__territory')
        if lock:
            queryset = queryset.select_for_update()
        return queryset.filter(token_digest=token_digest(token)).first()

    def _validate_link(self, link):
        if link is None:
            return self._error('invalid')
        if link.is_used:
            return self._error('used')
        if link.is_expired:
            return self._error('expired')
        if link.application.status != Application.Status.ACCEPTEE:
            return self._error('invalid')
        return None

    def get(self, request):
        token = request.query_params.get('token', '').strip()
        link = self._link(token) if token else None
        if error := self._validate_link(link):
            return error
        return Response(RegistrationPreviewSerializer(link.application).data)

    def post(self, request):
        token = request.data.get('token', '').strip()
        serializer = FinalizeRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            link = self._link(token, lock=True) if token else None
            if error := self._validate_link(link):
                return error
            application = link.application
            if User.objects.filter(email__iexact=application.email).exists():
                return Response(
                    {'detail': 'Un compte existe déjà pour ce courriel. Connectez-vous.', 'code': 'account_exists'},
                    status=status.HTTP_409_CONFLICT,
                )
            if not link.mark_used():
                return self._error('used' if link.is_used else 'expired')

            user = User.objects.create_user(
                email=application.email,
                password=serializer.validated_data['password'],
                first_name=application.first_name,
                last_name=application.last_name,
                role=User.Role.MEMBRE,
            )
            member = Member.objects.create(
                user=user,
                application=application,
                territory=application.territory,
                address=serializer.validated_data['address'],
                photo=serializer.validated_data['photo'],
            )
            application.status = Application.Status.INSCRITE
            application.save(update_fields=('status', 'updated_at'))

        return Response(
            {
                'membership_number': member.membership_number,
                'status': application.status,
                'status_label': application.get_status_display(),
                'email': user.email,
            },
            status=status.HTTP_201_CREATED,
        )
