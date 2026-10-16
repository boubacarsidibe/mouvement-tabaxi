"""Filtres de la base des membres, partagés par la liste et l'export Excel.

L'export reprend exactement ces filtres : le fichier contient la liste affichée, ni plus ni moins.
Paramètres reconnus : ``role`` (un ou plusieurs rôles séparés par des virgules, ``membre`` par
défaut), ``status``, ``territory`` (le territoire et tous ceux qui en dépendent), ``joined_from`` et
``joined_to`` (date d'adhésion, bornes comprises, au format AAAA-MM-JJ), ``search`` (prénom, nom,
courriel ou numéro ; plusieurs mots doivent tous correspondre) et ``ordering``.
"""

from django.db.models import Q
from rest_framework.exceptions import ValidationError

from accounts.models import User
from core.filters import read_period
from territories.models import Territory
from territories.scope import scope_queryset, subtree_ids

from .models import Member

UNKNOWN_TERRITORY = 'Localité inconnue.'

ORDERINGS = {
    'name': ('user__last_name', 'user__first_name'),
    'place': ('user__territory__name',),
    'date': ('joined_on', 'id'),
}
DEFAULT_ORDERING = '-date'


def scoped_members(user):
    """Membres que le bureau peut voir : tout pour un fondateur, son territoire et ceux qui en dépendent sinon."""
    queryset = Member.objects.select_related('user__territory__parent__parent')
    return scope_queryset(queryset, user, 'user__territory')


def read_roles(params):
    """Rôles demandés ; les membres simples si le paramètre est absent."""
    raw = params.get('role', '').strip() or User.Role.MEMBRE
    roles = [role.strip() for role in raw.split(',') if role.strip()]
    unknown = [role for role in roles if role not in User.Role.values]
    if unknown or not roles:
        raise ValidationError({'role': ['Rôle inconnu.']})
    return roles


def filter_members(queryset, params):
    """Applique les filtres de la requête à une liste de membres déjà limitée au périmètre."""
    queryset = queryset.filter(user__role__in=read_roles(params))

    status = params.get('status')
    if status:
        if status not in Member.Status.values:
            raise ValidationError({'status': ['Statut inconnu.']})
        queryset = queryset.filter(status=status)

    territory = params.get('territory', '').strip()
    if territory:
        try:
            root = Territory.objects.get(pk=int(territory))
        except (ValueError, Territory.DoesNotExist):
            raise ValidationError({'territory': [UNKNOWN_TERRITORY]})
        queryset = queryset.filter(user__territory__in=subtree_ids(root))

    joined_from, joined_to = read_period(params, 'joined_from', 'joined_to')
    if joined_from:
        queryset = queryset.filter(joined_on__gte=joined_from)
    if joined_to:
        queryset = queryset.filter(joined_on__lte=joined_to)

    for term in params.get('search', '').split():
        queryset = queryset.filter(
            Q(user__first_name__icontains=term)
            | Q(user__last_name__icontains=term)
            | Q(user__email__icontains=term)
            | Q(number__icontains=term)
        )
    return queryset


def order_members(queryset, params):
    ordering = params.get('ordering') or DEFAULT_ORDERING
    key = ordering.lstrip('-')
    if key not in ORDERINGS:
        raise ValidationError({'ordering': ['Tri inconnu.']})
    descending = ordering.startswith('-')
    return queryset.order_by(*(f'-{field}' if descending else field for field in ORDERINGS[key]))


def describe_filters(params):
    """Filtres appliqués, en clair, pour le journal des exports : ``{'Localité': 'Dakar', 'Statut': 'Actif'}``."""
    labels = {}
    roles = read_roles(params)
    labels['Fonction'] = ', '.join(User.Role(role).label for role in roles)
    if params.get('status'):
        labels['Statut'] = Member.Status(params['status']).label
    if params.get('territory', '').strip():
        labels['Localité'] = Territory.objects.get(pk=int(params['territory'])).name
    if params.get('joined_from', '').strip():
        labels['Du'] = params['joined_from'].strip()
    if params.get('joined_to', '').strip():
        labels['Au'] = params['joined_to'].strip()
    if params.get('search', '').strip():
        labels['Recherche'] = params['search'].strip()
    return labels
