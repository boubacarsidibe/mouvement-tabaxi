"""Filtres du journal, partagés par la liste et l'export Excel.

Paramètres : ``action``, ``actor`` (identifiant de l'auteur), ``search`` (auteur ou personne concernée ;
plusieurs mots doivent tous correspondre), ``date_from`` et ``date_to`` (AAAA-MM-JJ, bornes comprises).
"""

from django.db.models import Q
from rest_framework.exceptions import ValidationError

from accounts.models import User
from core.filters import read_period

from .models import AuditEntry


def filter_entries(queryset, params):
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


def describe_filters(params):
    """Filtres appliqués, en clair, pour le journal des exports."""
    labels = {}
    if params.get('action'):
        labels['Action'] = AuditEntry.Action(params['action']).label
    if params.get('actor', '').strip():
        user = User.objects.filter(pk=int(params['actor'])).first()
        labels['Auteur'] = (user.get_full_name().strip() or user.email) if user else params['actor']
    if params.get('date_from', '').strip():
        labels['Du'] = params['date_from'].strip()
    if params.get('date_to', '').strip():
        labels['Au'] = params['date_to'].strip()
    if params.get('search', '').strip():
        labels['Recherche'] = params['search'].strip()
    return labels
