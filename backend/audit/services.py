"""Écriture dans le journal des actions.

À appeler dans la transaction de l'action elle-même : si l'action est annulée (un courriel
qui ne part pas, par exemple), sa ligne de journal l'est aussi, et inversement une action
enregistrée a toujours sa ligne.
"""

from .models import AuditEntry


def person_name(user):
    """Nom d'une personne tel qu'on l'écrit dans le journal : prénom et nom, à défaut le courriel."""
    return user.get_full_name().strip() or user.email


def record(action, *, actor, subject, **details):
    """Ajoute une ligne au journal. ``details`` ne contient que des valeurs simples (texte, nombres)."""
    return AuditEntry.objects.create(
        action=action,
        actor=actor,
        actor_name=person_name(actor) if actor is not None else 'Système',
        subject=subject,
        details=details,
    )
