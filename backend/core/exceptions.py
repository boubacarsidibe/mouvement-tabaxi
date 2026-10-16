from rest_framework.exceptions import NotAuthenticated
from rest_framework.views import exception_handler

SESSION_EXPIRED = 'Votre session a été fermée après une période sans activité. Reconnectez-vous.'


def api_exception_handler(exc, context):
    """Réponses d'erreur de l'API, avec un code stable que le frontend peut tester."""
    response = exception_handler(exc, context)
    if response is None or not isinstance(response.data, dict) or 'detail' not in response.data:
        return response
    request = context.get('request')
    if isinstance(exc, NotAuthenticated) and getattr(request, 'session_expired', False):
        response.data = {'detail': SESSION_EXPIRED, 'code': 'session_expired'}
    else:
        code = getattr(response.data['detail'], 'code', None) or getattr(exc, 'default_code', 'error')
        response.data.setdefault('code', code)
    return response
