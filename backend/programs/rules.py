"""Règles de droit des programmes et des activités.

- Le bureau gère les programmes de son périmètre : un coordonnateur, son territoire et ceux qui en
  dépendent ; un fondateur, tout (``territories.scope``). Hors périmètre, un programme n'existe pas : 404.
- Un membre voit les programmes de son territoire et de ceux dont il dépend (le programme d'une région
  concerne les membres de ses communes), jamais ceux des autres territoires, et pas les programmes annulés.
"""

from django.db.models import Q

from accounts.models import User
from members.models import Member
from territories.scope import ancestor_ids, scope_queryset, subtree_ids

from .models import Activity, Program


def bureau_programs(user):
    """Programmes que le bureau peut voir et gérer."""
    queryset = Program.objects.select_related('territory__parent__parent', 'manager')
    return scope_queryset(queryset, user, 'territory')


def bureau_activities(user):
    queryset = Activity.objects.select_related('program__territory__parent__parent', 'report_author')
    return scope_queryset(queryset, user, 'program__territory')


def member_programs(user):
    """Programmes visibles par un membre : ceux de son territoire et de ceux dont il dépend, sans les annulés."""
    queryset = Program.objects.exclude(status=Program.Status.CANCELLED).select_related(
        'territory__parent__parent', 'manager'
    )
    if user.is_founder:
        return queryset  # un fondateur n'a pas de territoire : il voit tout
    if user.territory_id is None:
        return queryset.none()
    return queryset.filter(territory_id__in=ancestor_ids(user.territory))


def member_activities(user):
    queryset = Activity.objects.exclude(program__status=Program.Status.CANCELLED).select_related(
        'program__territory__parent__parent', 'program__manager'
    )
    if user.is_founder:
        return queryset
    if user.territory_id is None:
        return queryset.none()
    return queryset.filter(program__territory_id__in=ancestor_ids(user.territory))


def eligible_managers(territory):
    """Comptes du bureau qui peuvent être responsables d'un programme de ce territoire.

    Un fondateur, ou un coordonnateur dont le territoire est celui du programme ou l'un de ceux dont il
    dépend : c'est lui qui le gère.
    """
    users = User.objects.filter(is_active=True).filter(
        Q(role=User.Role.FONDATEUR) | Q(role=User.Role.COORDONNATEUR, territory_id__in=ancestor_ids(territory))
    )
    return users.order_by('last_name', 'first_name', 'email')


def attendance_candidates(activity):
    """Membres qu'on peut cocher : les inscrits, et les membres actifs du territoire du programme."""
    members = Member.objects.select_related('user__territory').filter(
        user__territory_id__in=subtree_ids(activity.program.territory),
        user__role=User.Role.MEMBRE,
        status=Member.Status.ACTIF,
    )
    registered = Member.objects.select_related('user__territory').filter(registrations__activity=activity)
    ids = set(members.values_list('pk', flat=True)) | set(registered.values_list('pk', flat=True))
    return Member.objects.select_related('user__territory').filter(pk__in=ids).order_by(
        'user__last_name', 'user__first_name', 'id'
    )
