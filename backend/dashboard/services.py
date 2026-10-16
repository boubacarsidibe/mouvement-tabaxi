"""Chiffres du tableau de bord du bureau, limités au territoire de la personne connectée.

Les chiffres se calculent sur les mêmes listes que les écrans (``members.filters.scoped_members``,
``territories.scope``) : ce qu'affiche le tableau de bord correspond à ce que les listes contiennent.
"""

from datetime import date

from django.db.models import Count, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone

from accounts.models import User
from applications.models import Application
from audit.models import AuditEntry
from members.filters import scoped_members
from members.models import Member
from territories.models import Territory
from territories.scope import scope_queryset
from territories.serializers import territory_path

BUREAU_ROLES = (User.Role.COORDONNATEUR, User.Role.FONDATEUR)
MONTHS = 12
RECENT = 5


def month_starts(today, count=MONTHS):
    """Premier jour de chacun des ``count`` derniers mois, du plus ancien au mois en cours."""
    year, month = today.year, today.month
    starts = []
    for _ in range(count):
        starts.append(date(year, month, 1))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(starts))


def territory_summary(territory):
    return {
        'id': territory.pk,
        'name': territory.name,
        'kind': territory.kind,
        'kind_label': territory.get_kind_display(),
        'path': territory_path(territory),
    }


def scope_of(user):
    """Périmètre affiché en tête du tableau de bord : tout pour un fondateur, un territoire sinon."""
    if user.is_founder or user.territory is None:
        return {'all': True, 'territory': None}
    return {'all': False, 'territory': territory_summary(user.territory)}


def territory_breakdown(active):
    """Membres actifs et coordonnateurs actifs de chaque territoire du périmètre, les plus nombreux d'abord."""
    rows = (
        active.exclude(user__territory=None)
        .values('user__territory')
        .annotate(
            members=Count('id', filter=Q(user__role=User.Role.MEMBRE)),
            coordinators=Count('id', filter=Q(user__role__in=BUREAU_ROLES)),
        )
    )
    territories = {
        t.pk: t
        for t in Territory.objects.filter(pk__in=[row['user__territory'] for row in rows]).select_related('parent__parent')
    }
    result = [
        {
            'territory': territory_summary(territories[row['user__territory']]),
            'members': row['members'],
            'coordinators': row['coordinators'],
        }
        for row in rows
    ]
    result.sort(key=lambda item: (-item['members'], -item['coordinators'], item['territory']['name']))
    return result


def monthly_joined(members, today):
    """Nouveaux membres simples par mois sur les douze derniers mois (zéro pour un mois sans adhésion)."""
    starts = month_starts(today)
    counts = {
        row['month']: row['count']
        for row in members.filter(user__role=User.Role.MEMBRE, joined_on__gte=starts[0])
        .annotate(month=TruncMonth('joined_on'))
        .values('month')
        .annotate(count=Count('id'))
    }
    return [{'month': start.strftime('%Y-%m'), 'count': counts.get(start, 0)} for start in starts]


def build(user):
    """Tableau de bord de la personne connectée. Les demandes et le journal ne sont montrés qu'aux fondateurs."""
    today = timezone.localdate()
    members = scoped_members(user)
    active = members.filter(status=Member.Status.ACTIF)
    pending = scope_queryset(
        Application.objects.filter(status=Application.Status.A_EXAMINER), user, 'territory'
    )
    month_start = date(today.year, today.month, 1)

    data = {
        'scope': scope_of(user),
        'active_members': active.filter(user__role=User.Role.MEMBRE).count(),
        'joined_this_month': members.filter(user__role=User.Role.MEMBRE, joined_on__gte=month_start).count(),
        'coordinators': active.filter(user__role__in=BUREAU_ROLES).count(),
        'pending_applications': pending.count(),
        'territories': territory_breakdown(active),
        'monthly_joined': monthly_joined(members, today),
        'recent_applications': None,
        'recent_actions': None,
    }
    if user.is_founder:
        data['recent_applications'] = [
            {
                'id': application.pk,
                'reference': application.reference,
                'first_name': application.first_name,
                'last_name': application.last_name,
                'territory': application.territory.name,
                'created_at': application.created_at,
            }
            for application in pending.select_related('territory').order_by('-created_at', '-id')[:RECENT]
        ]
        data['recent_actions'] = list(AuditEntry.objects.all()[:RECENT])
    return data
