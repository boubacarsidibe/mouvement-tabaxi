from rest_framework import authentication


class SessionAuthentication(authentication.SessionAuthentication):
    """Authentification par cookie de session, qui distingue 401 et 403.

    Par défaut, Django REST Framework répond 403 à une personne non connectée
    quand seule la session est utilisée. En annonçant un schéma d'authentification,
    l'API répond 401 (« connectez-vous ») et réserve 403 à un accès refusé à une
    personne connectée. Le frontend peut ainsi rediriger vers la page de connexion.
    """

    def authenticate_header(self, request):
        return 'Session'
