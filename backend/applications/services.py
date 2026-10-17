"""Décisions des fondateurs sur les demandes d'adhésion.

Une décision n'est enregistrée que si le courriel qui l'annonce est parti : en cas
d'échec de l'envoi, la transaction est annulée, la demande reste « À examiner » et
``EmailNotSent`` remonte jusqu'au fondateur.
"""

from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

from audit.models import AuditEntry
from audit.services import record
from core.mail import send_email

from .models import Application, RegistrationLink

DECISION_SUBJECT = "Votre demande d'adhésion au Mouvement TABAXI"


class NotAccepted(Exception):
    """Le lien d'inscription ne se renvoie qu'à une demande « Acceptée » (pas encore inscrite)."""

    def __init__(self, application):
        self.application = application
        super().__init__(
            "Le lien d'inscription ne peut être renvoyé que pour une demande « Acceptée » "
            f'(statut actuel : {application.get_status_display()}).'
        )


class AlreadyDecided(Exception):
    """La demande n'est plus « À examiner » : une décision a déjà été prise."""

    def __init__(self, application):
        self.application = application
        super().__init__(f'Cette demande a déjà été traitée (statut : {application.get_status_display()}).')


def _lock_pending(application):
    """Verrouille la demande pour la durée de la décision et vérifie qu'elle attend encore."""
    locked = Application.objects.select_for_update().get(pk=application.pk)
    if locked.status != Application.Status.A_EXAMINER:
        raise AlreadyDecided(locked)
    return locked


def _record_decision(application, status, by, note):
    application.status = status
    application.decided_by = by
    application.decided_at = timezone.now()
    application.internal_note = note
    application.save()


def registration_url(token):
    """Adresse de la page de finalisation du frontend, avec le jeton du lien personnel."""
    return f'{settings.FRONTEND_URL.rstrip("/")}/finaliser?{urlencode({"jeton": token})}'


def _send_registration_link(application, *, resent=False):
    link, token = RegistrationLink.issue(application)
    body = render_to_string(
        'applications/emails/acceptance.txt',
        {'application': application, 'link': link, 'url': registration_url(token), 'resent': resent},
    )
    send_email(to=application.email, subject=DECISION_SUBJECT, body=body)
    return link


def accept(application, *, by, note=''):
    """Accepte la demande et envoie le lien personnel d'inscription (7 jours, usage unique).

    Si le courriel ne part pas, tout est annulé : pas de lien, demande « À examiner ».
    """
    with transaction.atomic():
        application = _lock_pending(application)
        _record_decision(application, Application.Status.ACCEPTEE, by, note)
        record(
            AuditEntry.Action.APPLICATION_ACCEPTED,
            actor=by,
            subject=f'{application.first_name} {application.last_name}',
            reference=application.reference,
            territory=application.territory.name,
        )
        _send_registration_link(application)
    return application


def resend_link(application, *, by):
    """Envoie un nouveau lien personnel à une personne acceptée qui n'a pas finalisé son inscription.

    Utile quand le lien a expiré ou que le courriel s'est perdu. Les liens précédents
    cessent de fonctionner : seul le dernier envoyé est valable. Si le courriel ne part
    pas, tout est annulé et les anciens liens restent tels quels.
    """
    with transaction.atomic():
        application = Application.objects.select_for_update().get(pk=application.pk)
        if application.status != Application.Status.ACCEPTEE:
            raise NotAccepted(application)
        now = timezone.now()
        RegistrationLink.objects.filter(application=application, used_at__isnull=True, expires_at__gt=now).update(
            expires_at=now
        )
        record(
            AuditEntry.Action.LINK_RESENT,
            actor=by,
            subject=f'{application.first_name} {application.last_name}',
            reference=application.reference,
            territory=application.territory.name,
        )
        _send_registration_link(application, resent=True)
    return application


def reject(application, *, by, reason, note=''):
    """Refuse la demande et envoie le motif à la personne."""
    with transaction.atomic():
        application = _lock_pending(application)
        application.rejection_reason = reason
        _record_decision(application, Application.Status.REJETEE, by, note)
        record(
            AuditEntry.Action.APPLICATION_REJECTED,
            actor=by,
            subject=f'{application.first_name} {application.last_name}',
            reference=application.reference,
            territory=application.territory.name,
            reason=reason,
        )
        body = render_to_string('applications/emails/rejection.txt', {'application': application})
        send_email(to=application.email, subject=DECISION_SUBJECT, body=body)
    return application
