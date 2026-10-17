"""Lecture des dates et des périodes dans les paramètres d'une liste (bases du bureau, journal)."""

from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

BAD_DATE = 'Saisissez une date valide au format AAAA-MM-JJ.'
BAD_PERIOD = 'La date de fin doit être égale ou postérieure à la date de début.'


def read_date(params, name):
    """Date du paramètre ``name`` (AAAA-MM-JJ), ou ``None`` s'il est absent ou vide."""
    value = params.get(name, '').strip()
    if not value:
        return None
    try:
        parsed = parse_date(value)
    except ValueError:  # forme correcte, date inexistante : 2026-02-30
        parsed = None
    if parsed is None:
        raise ValidationError({name: [BAD_DATE]})
    return parsed


def read_period(params, start='joined_from', end='joined_to'):
    """Bornes d'une période (comprises), vérifiées : la fin ne précède pas le début."""
    first = read_date(params, start)
    last = read_date(params, end)
    if first and last and last < first:
        raise ValidationError({end: [BAD_PERIOD]})
    return first, last
