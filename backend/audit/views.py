from django.db.models import Q
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsFounder
from core.filters import read_period

from .models import AuditEntry
from .serializers import AuditEntrySerializer


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
        params = self.request.query_params
        queryset = AuditEntry.objects.all()

        action = params.get('action')
        if action:
            if action not in AuditEntry.Action.values:
                raise ValidationError({'action': ['Action inconnue.']})
            queryset = queryset.filter(action=action)

        actor = params.get('actor', '').strip()
        if actor:
            if not actor.isdigit():
                raise ValidationError({'actor': ['Auteur inconnu.']})
            queryset = queryset.filter(actor_id=int(actor))

        first, last = read_period(params, 'date_from', 'date_to')
        if first:
            queryset = queryset.filter(created_at__date__gte=first)
        if last:
            queryset = queryset.filter(created_at__date__lte=last)

        for term in params.get('search', '').split():
            queryset = queryset.filter(Q(actor_name__icontains=term) | Q(subject__icontains=term))
        return queryset


class AuditActorsView(APIView):
    """Personnes qui ont agi, pour le filtre « auteur » du journal."""

    permission_classes = [IsFounder]

    def get(self, request):
        users = User.objects.filter(audit_entries__isnull=False).distinct().order_by('last_name', 'first_name', 'email')
        return Response([{'id': user.pk, 'name': user.get_full_name().strip() or user.email} for user in users])
