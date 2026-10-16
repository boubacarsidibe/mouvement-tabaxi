from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsFounder

from .exports import export_list
from .filters import describe_filters, filter_entries
from .models import AuditEntry
from .serializers import AuditEntrySerializer, describe


class AuditPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class AuditListView(generics.ListAPIView):
    """Journal des actions, réservé aux fondateurs, en lecture seule, du plus récent au plus ancien.

    Filtres : ``action``, ``actor`` (identifiant de l'auteur), ``search`` (auteur ou personne
    concernée ; plusieurs mots doivent tous correspondre), ``date_from`` et ``date_to`` (AAAA-MM-JJ,
    bornes comprises).
    """

    permission_classes = [IsFounder]
    serializer_class = AuditEntrySerializer
    pagination_class = AuditPagination

    def get_queryset(self):
        return filter_entries(AuditEntry.objects.all(), self.request.query_params)


class AuditActorsView(APIView):
    """Personnes qui ont agi, pour le filtre « auteur » du journal."""

    permission_classes = [IsFounder]

    def get(self, request):
        users = User.objects.filter(audit_entries__isnull=False).distinct().order_by('last_name', 'first_name', 'email')
        return Response([{'id': user.pk, 'name': user.get_full_name().strip() or user.email} for user in users])


class AuditExportView(APIView):
    """Export Excel du journal affiché (mêmes filtres) ; l'export lui-même est noté dans le journal."""

    permission_classes = [IsFounder]

    def get(self, request):
        params = request.query_params
        entries = filter_entries(AuditEntry.objects.all(), params)
        rows = (
            (entry.created_at, entry.get_action_display(), entry.subject, describe(entry), entry.actor_name)
            for entry in entries
        )
        return export_list(
            request,
            base_name='journal',
            subject='Journal des actions',
            headers=['Date', 'Action', 'Concerne', 'Détail', 'Auteur'],
            rows=rows,
            filters=describe_filters(params),
        )
