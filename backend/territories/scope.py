"""Règle d'accès par territoire, réutilisable par toutes les listes du bureau.

- Un fondateur voit tous les territoires.
- Un coordonnateur voit son territoire et tous ceux qui en dépendent : un coordonnateur
  de région voit ses communes, un coordonnateur de pays ses régions et leurs communes.
- Les autres comptes ne voient aucun territoire du bureau.

Usage dans une vue :
    queryset = scope_queryset(Member.objects.all(), request.user)               # champ « territory »
    queryset = scope_queryset(Activity.objects.all(), request.user, 'program__territory')
Un objet hors du périmètre doit répondre 404, pas 403 : on ne révèle pas qu'il existe.
"""

from .models import Territory


def subtree_ids(territory):
    """Identifiants du territoire et de tous ceux qui en dépendent."""
    ids = {territory.pk}
    frontier = {territory.pk}
    while frontier:
        frontier = set(Territory.objects.filter(parent_id__in=frontier).values_list('pk', flat=True)) - ids
        ids |= frontier
    return ids


def ancestor_ids(territory):
    """Identifiants du territoire et de tous ceux dont il dépend (une commune, sa région, son pays)."""
    ids = []
    while territory is not None:
        ids.append(territory.pk)
        territory = territory.parent
    return ids


def visible_territory_ids(user):
    """Territoires que l'utilisateur peut voir au bureau ; None signifie « tous »."""
    if not user.is_authenticated:
        return set()
    if user.is_founder:
        return None
    if user.is_bureau and user.territory_id:
        return subtree_ids(user.territory)
    return set()


def visible_territories(user):
    ids = visible_territory_ids(user)
    queryset = Territory.objects.all()
    return queryset if ids is None else queryset.filter(pk__in=ids)


def scope_queryset(queryset, user, field='territory'):
    """Restreint une liste aux objets rattachés à un territoire visible par l'utilisateur."""
    ids = visible_territory_ids(user)
    if ids is None:
        return queryset
    return queryset.filter(**{f'{field}__in': ids})


def can_access(user, territory):
    ids = visible_territory_ids(user)
    return ids is None or (territory is not None and territory.pk in ids)
