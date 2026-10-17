import unicodedata

from django.db.models import Count, IntegerField, OuterRef, ProtectedError, Subquery
from django.db.models.functions import Coalesce
from rest_framework import generics, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import SAFE_METHODS, AllowAny, BasePermission
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsBureau
from applications.models import Application
from programs.models import Program

from .models import Territory
from .scope import visible_territories
from .serializers import TerritoryUsageSerializer, TerritoryWriteSerializer, territory_path


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


BUREAU_ROLES = (User.Role.COORDONNATEUR, User.Role.FONDATEUR)


def count_of(model, field, **filters):
    """Nombre de lignes de ``model`` rattachées au territoire, en sous-requête.

    Des ``Count`` joints multiplieraient les lignes (membres × programmes × demandes)
    sur un territoire très peuplé ; chaque sous-requête compte une seule table.
    """
    rows = (
        model.objects.filter(**{field: OuterRef('pk')}, **filters)
        .order_by()
        .values(field)
        .annotate(total=Count('pk'))
        .values('total')
    )
    return Coalesce(Subquery(rows, output_field=IntegerField()), 0)


def with_usage(queryset):
    """Territoires avec ce qui y est rattaché directement : membres, coordonnateurs, programmes, demandes, territoires."""
    return queryset.annotate(
        members_count=count_of(User, 'territory', role=User.Role.MEMBRE),
        coordinators_count=count_of(User, 'territory', role__in=BUREAU_ROLES),
        programs_count=count_of(Program, 'territory'),
        applications_count=count_of(Application, 'territory'),
        children_count=count_of(Territory, 'parent'),
    )


class FounderWrites(BasePermission):
    """Lecture pour tout le bureau (dans son périmètre) ; ajout, modification et suppression pour les fondateurs."""

    message = 'Seuls les membres fondateurs peuvent modifier les territoires.'

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_founder


def deletion_obstacle(territory):
    """Raison pour laquelle un territoire ne peut pas être supprimé, ou None s'il est vide."""
    reasons = []
    if territory.children.exists():
        reasons.append("il contient d'autres territoires")
    if territory.users.filter(role=User.Role.MEMBRE).exists():
        reasons.append('des membres y sont rattachés')
    if territory.users.filter(role__in=BUREAU_ROLES).exists():
        reasons.append('des coordonnateurs y sont rattachés')
    if territory.programs.exists():
        reasons.append('des programmes y sont rattachés')
    if territory.applications.exists():
        reasons.append("des demandes d'adhésion le concernent")
    if not reasons:
        return None
    return f"{territory.name} ne peut pas être supprimé : {', '.join(reasons)}. Désactivez-le plutôt."


class ManagedTerritoryListView(generics.ListCreateAPIView):
    """Territoires du périmètre de la personne connectée (bureau exécutif).

    Un coordonnateur reçoit son territoire et ceux qui en dépendent ; un fondateur, tous
    les territoires, actifs ou non. Seul un fondateur en ajoute.
    """

    permission_classes = [IsBureau, FounderWrites]
    pagination_class = None

    def get_serializer_class(self):
        return TerritoryWriteSerializer if self.request.method == 'POST' else TerritoryUsageSerializer

    def get_queryset(self):
        return with_usage(visible_territories(self.request.user)).select_related('parent__parent')

    def list(self, request, *args, **kwargs):
        territories = sorted(self.get_queryset(), key=lambda t: french_sort_key(territory_path(t)))
        return Response(self.get_serializer(territories, many=True).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        territory = serializer.save()
        data = TerritoryUsageSerializer(with_usage(Territory.objects.filter(pk=territory.pk)).get()).data
        return Response(data, status=status.HTTP_201_CREATED)


class ManagedTerritoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Un territoire du périmètre. Hors périmètre : 404, même en changeant l'adresse à la main.

    Un fondateur le renomme, le rattache ailleurs, le désactive, ou le supprime s'il est vide.
    """

    permission_classes = [IsBureau, FounderWrites]

    def get_serializer_class(self):
        return TerritoryUsageSerializer if self.request.method in SAFE_METHODS else TerritoryWriteSerializer

    def get_queryset(self):
        return with_usage(visible_territories(self.request.user)).select_related('parent__parent')

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        return Response(TerritoryUsageSerializer(self.get_queryset().get(pk=self.kwargs['pk'])).data)

    def destroy(self, request, *args, **kwargs):
        territory = self.get_object()
        obstacle = deletion_obstacle(territory)
        if obstacle is None:
            try:
                territory.delete()
            except ProtectedError:
                obstacle = f'{territory.name} est encore utilisé : désactivez-le plutôt.'
        if obstacle:
            return Response({'detail': obstacle}, status=status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)
