"""Filtres de la liste des programmes du bureau, partagés par la liste et l'export Excel.

Paramètres : ``status``, ``territory`` (le territoire et ceux qui en dépendent), ``search`` (nom ou objectif ;
plusieurs mots doivent tous correspondre) et ``ordering`` (``name`` ou ``date``, précédé de ``-`` pour inverser ;
les plus récents d'abord par défaut).
"""

from django.db.models import Count, Q
from rest_framework.exceptions import ValidationError

from territories.models import Territory
from territories.scope import subtree_ids

from .models import Program

ORDERINGS = {'name': ('name',), 'date': ('start_date', 'id')}


def filter_programs(queryset, params):
    status = params.get('status')
    if status:
        if status not in Program.Status.values:
            raise ValidationError({'status': ['État inconnu.']})
        queryset = queryset.filter(status=status)

    territory = params.get('territory', '').strip()
    if territory:
        try:
            root = Territory.objects.get(pk=int(territory))
        except (ValueError, Territory.DoesNotExist):
            raise ValidationError({'territory': ['Localité inconnue.']})
        queryset = queryset.filter(territory__in=subtree_ids(root))

    for term in params.get('search', '').split():
        queryset = queryset.filter(Q(name__icontains=term) | Q(objective__icontains=term))

    ordering = params.get('ordering') or '-date'
    key = ordering.lstrip('-')
    if key not in ORDERINGS:
        raise ValidationError({'ordering': ['Tri inconnu.']})
    fields = [f'-{f}' if ordering.startswith('-') else f for f in ORDERINGS[key]]
    return queryset.annotate(activities_count=Count('activities', distinct=True)).order_by(*fields)


def describe_filters(params):
    """Filtres appliqués, en clair, pour le journal des exports."""
    labels = {}
    if params.get('status'):
        labels['État'] = Program.Status(params['status']).label
    if params.get('territory', '').strip():
        labels['Localité'] = Territory.objects.get(pk=int(params['territory'])).name
    if params.get('search', '').strip():
        labels['Recherche'] = params['search'].strip()
    return labels
