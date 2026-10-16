"""Filtres de la liste des demandes, partagés par la liste et l'export Excel.

Paramètres : ``status`` (un des statuts) et ``search`` (nom, prénom, courriel ou référence).
"""

from django.db.models import Q
from rest_framework.exceptions import ValidationError

from .models import Application


def filter_applications(queryset, params):
    status = params.get('status')
    if status:
        if status not in Application.Status.values:
            raise ValidationError({'status': ['Statut inconnu.']})
        queryset = queryset.filter(status=status)
    search = params.get('search', '').strip()
    if search:
        queryset = queryset.filter(
            Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(email__icontains=search)
            | Q(reference__icontains=search)
        )
    return queryset


def describe_filters(params):
    """Filtres appliqués, en clair, pour le journal des exports."""
    labels = {}
    if params.get('status'):
        labels['Statut'] = Application.Status(params['status']).label
    if params.get('search', '').strip():
        labels['Recherche'] = params['search'].strip()
    return labels
