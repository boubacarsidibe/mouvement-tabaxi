from django.conf import settings
from django.contrib.auth import logout
from django.utils import timezone

LAST_ACTIVITY_KEY = 'derniere_activite'
WRITE_INTERVAL = 60  # secondes


class BureauInactivityMiddleware:
    """Ferme la session d'un membre du bureau après une période sans action (30 minutes).

    Protège les données des membres si un coordonnateur ou un fondateur oublie de se
    déconnecter. Chaque requête compte comme une action. Les membres simples ne sont
    pas concernés.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user is not None and user.is_authenticated and user.is_bureau:
            now = timezone.now().timestamp()
            last = request.session.get(LAST_ACTIVITY_KEY)
            if last is not None and now - last > settings.BUREAU_INACTIVITY_MINUTES * 60:
                logout(request)
                # Lu par core.exceptions pour expliquer le 401 au frontend.
                request.session_expired = True
            elif last is None or now - last >= WRITE_INTERVAL:
                # Une écriture par minute au plus : inutile d'enregistrer la session à chaque requête.
                request.session[LAST_ACTIVITY_KEY] = now
        return self.get_response(request)
