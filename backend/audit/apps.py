from django.apps import AppConfig


class AuditConfig(AppConfig):
    """Journal des actions importantes : qui a fait quoi et quand, sans modification possible."""

    name = 'audit'
    verbose_name = 'Journal des actions'
