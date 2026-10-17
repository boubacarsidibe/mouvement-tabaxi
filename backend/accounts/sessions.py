from django.contrib.auth import SESSION_KEY
from django.contrib.sessions.models import Session
from django.utils import timezone


def close_sessions(user):
    """Ferme toutes les sessions ouvertes d'un compte (suspension, radiation).

    Un compte désactivé ne passe déjà plus l'authentification ; supprimer les sessions
    évite qu'elles ne redeviennent valables si le compte est réactivé plus tard.
    """
    key = str(user.pk)
    for session in Session.objects.filter(expire_date__gt=timezone.now()).iterator():
        if session.get_decoded().get(SESSION_KEY) == key:
            session.delete()
