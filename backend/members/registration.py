"""Finalisation de l'inscription avec le lien personnel reçu à l'acceptation (besoin A4)."""

from django.db import transaction
from django.utils import timezone

from accounts.models import User
from applications.models import Application, RegistrationLink

from .models import Member


class LinkProblem(Exception):
    """Le lien ne permet pas (ou plus) de finaliser l'inscription. Le message dit quoi faire."""

    def __init__(self, code, detail, status):
        super().__init__(detail)
        self.code, self.detail, self.status = code, detail, status


INVALID_LINK = (
    'invalid_link',
    "Ce lien n'est pas valide. Vérifiez qu'il est complet, ou écrivez au mouvement pour recevoir de l'aide.",
    404,
)
EXPIRED_LINK = (
    'link_expired',
    'Ce lien a expiré : il était valable 7 jours. Écrivez au mouvement pour en recevoir un nouveau.',
    410,
)
USED_LINK = (
    'link_used',
    'Ce lien a déjà servi. Connectez-vous avec votre courriel et votre mot de passe.',
    410,
)
ACCOUNT_EXISTS = (
    'account_exists',
    'Un compte existe déjà avec ce courriel. Connectez-vous, ou utilisez « Mot de passe oublié ».',
    409,
)


def check_link(token):
    """Renvoie le lien s'il permet de finaliser l'inscription, sinon lève LinkProblem."""
    link = RegistrationLink.find(token) if token else None
    if link is None:
        raise LinkProblem(*INVALID_LINK)
    if link.is_used or link.application.status == Application.Status.INSCRITE:
        raise LinkProblem(*USED_LINK)
    if link.is_expired:
        raise LinkProblem(*EXPIRED_LINK)
    if link.application.status != Application.Status.ACCEPTEE:
        raise LinkProblem(*INVALID_LINK)
    return link


def complete_registration(token, *, password, address, phone, photo, rules_accepted):
    """Crée le compte membre et son dossier, consomme le lien, marque la demande « Inscrite ».

    Tout se fait dans une seule transaction : en cas de problème, rien n'est créé et le
    lien reste utilisable.
    """
    member = None
    try:
        with transaction.atomic():
            link = check_link(token)
            link = RegistrationLink.objects.select_for_update().select_related('application').get(pk=link.pk)
            application = link.application
            if User.objects.filter(email__iexact=application.email).exists():
                raise LinkProblem(*ACCOUNT_EXISTS)
            user = User.objects.create_user(
                application.email,
                password,
                first_name=application.first_name,
                last_name=application.last_name,
                role=User.Role.MEMBRE,
                territory=application.territory,
            )
            member = Member.objects.create(
                user=user,
                address=address,
                phone=phone,
                photo=photo,
                application=application,
                rules_accepted_at=timezone.now() if rules_accepted else None,
            )
            if not link.mark_used():
                # Le même lien vient de servir dans une autre requête.
                raise LinkProblem(*USED_LINK)
            application.status = Application.Status.INSCRITE
            application.save(update_fields=['status', 'updated_at'])
    except Exception:
        # La base est revenue en arrière ; la photo déjà écrite sur le disque doit suivre.
        if member is not None and member.photo:
            member.photo.storage.delete(member.photo.name)
        raise
    return user
