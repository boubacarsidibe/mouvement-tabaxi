from rest_framework.permissions import BasePermission

from .models import User


class IsFounder(BasePermission):
    """Réservé aux membres fondateurs (examen des demandes, gestion des territoires…)."""

    message = 'Seuls les membres fondateurs ont accès à cette fonction.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == User.Role.FONDATEUR)


class IsBureau(BasePermission):
    """Réservé au bureau exécutif : coordonnateurs et fondateurs.

    Ce que chacun voit ensuite dépend de son territoire (territories.scope).
    """

    message = 'Cette fonction est réservée au bureau exécutif.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_bureau)
