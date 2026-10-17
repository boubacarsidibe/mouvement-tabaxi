from django.utils import timezone

from applications.models import Application


def make_application(territory, email='awa.ndiaye@example.org', **extra):
    """Demande enregistrée directement en base, comme après un dépôt."""
    fields = {
        'first_name': 'Awa', 'last_name': 'Ndiaye', 'email': email, 'territory': territory,
        'profession': 'Enseignante', 'motivation': 'Agir pour ma commune.', 'consent_at': timezone.now(),
    }
    return Application.objects.create(**{**fields, **extra})
