from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Éléments communs à toute l'API : point de contrôle, services partagés."""

    name = 'core'
    verbose_name = 'Socle'
