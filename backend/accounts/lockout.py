"""Blocage temporaire de la connexion après plusieurs échecs.

Deux compteurs, sur une fenêtre glissante :
- par compte : après ``LOGIN_MAX_FAILURES_PER_ACCOUNT`` échecs pour un même courriel,
  ce courriel est bloqué, même avec le bon mot de passe ;
- par adresse IP : après ``LOGIN_MAX_FAILURES_PER_IP`` échecs depuis une même adresse,
  quels que soient les courriels essayés.
Le blocage dure jusqu'à ce que les échecs sortent de la fenêtre (``LOGIN_LOCKOUT_MINUTES``).
Une connexion réussie efface les échecs du compte.
"""

import ipaddress
import math
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import LoginFailure

# Les échecs plus anciens ne servent plus à rien : ils sont effacés.
RETENTION = timedelta(days=1)


def _valid_ip(value):
    """Adresse IP valide, sans port éventuel, ou None : la base n'accepte que de vraies adresses."""
    value = (value or '').strip()
    if value.startswith('[') and ']' in value:  # [IPv6]:port
        value = value[1:value.index(']')]
    elif value.count(':') == 1:  # IPv4:port
        value = value.split(':', 1)[0]
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def client_ip(request):
    """Adresse du visiteur. Derrière un proxy de confiance, elle est lue dans X-Forwarded-For."""
    proxies = settings.LOGIN_TRUSTED_PROXIES
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if proxies and forwarded:
        addresses = [a.strip() for a in forwarded.split(',') if a.strip()]
        if addresses:
            return _valid_ip(addresses[-min(proxies, len(addresses))])
    return _valid_ip(request.META.get('REMOTE_ADDR'))


def _window():
    return timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)


def remaining_lock(email, ip):
    """Durée de blocage restante (timedelta), ou None si la connexion est permise."""
    now = timezone.now()
    since = now - _window()
    recent = LoginFailure.objects.filter(created_at__gt=since)
    checks = [(recent.filter(email=email.lower()), settings.LOGIN_MAX_FAILURES_PER_ACCOUNT)]
    if ip:
        checks.append((recent.filter(ip_address=ip), settings.LOGIN_MAX_FAILURES_PER_IP))
    longest = None
    for failures, limit in checks:
        dates = list(failures.order_by('-created_at').values_list('created_at', flat=True)[:limit])
        if len(dates) >= limit:
            # Bloqué tant que le plus ancien des `limit` derniers échecs reste dans la fenêtre.
            remaining = dates[-1] + _window() - now
            if longest is None or remaining > longest:
                longest = remaining
    return longest


def record_failure(email, ip):
    LoginFailure.objects.create(email=email.lower(), ip_address=ip)
    LoginFailure.objects.filter(created_at__lt=timezone.now() - RETENTION).delete()


def clear_failures(email):
    LoginFailure.objects.filter(email=email.lower()).delete()


def lock_message(remaining):
    minutes = max(1, math.ceil(remaining.total_seconds() / 60))
    unit = 'minute' if minutes == 1 else 'minutes'
    return f'Trop de tentatives de connexion. Réessayez dans {minutes} {unit}.'
