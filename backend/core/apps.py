from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Éléments communs à toute l'API : point de contrôle, services partagés."""

    name = 'core'
    verbose_name = 'Socle'

    def ready(self):
        from . import checks  # noqa: F401  (enregistre les contrôles de déploiement)
