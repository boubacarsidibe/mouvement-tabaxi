import unicodedata

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Territory


def french_sort_key(name):
    """Ordre alphabétique français : « Kédougou » avant « Kolda »."""
    without_accents = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    return (without_accents.casefold(), name)


def active_tree():
    """Territoires actifs sous forme d'arbre pays > région > commune.

    Un territoire n'apparaît que si lui et tous ses parents sont actifs : désactiver
    une région retire aussi ses communes des formulaires.
    """
    territories = Territory.objects.filter(is_active=True).only('id', 'name', 'kind', 'parent_id')
    labels = dict(Territory.Kind.choices)
    nodes = {
        t.id: {'id': t.id, 'name': t.name, 'kind': t.kind, 'kind_label': labels[t.kind], 'children': []}
        for t in territories
    }
    roots = []
    for t in territories:
        if t.parent_id is None:
            roots.append(nodes[t.id])
        elif t.parent_id in nodes:
            nodes[t.parent_id]['children'].append(nodes[t.id])

    def sort(branch):
        branch.sort(key=lambda node: french_sort_key(node['name']))
        for node in branch:
            sort(node['children'])

    sort(roots)
    return roots


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def territory_tree(request):
    """Liste publique des territoires, pour le formulaire d'adhésion."""
    return Response(active_tree())
