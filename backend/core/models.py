from django.db import models
from django.utils import timezone

from .tokens import new_token, token_digest


class OneTimeLink(models.Model):
    """Base des liens personnels envoyés par courriel : inscription, mot de passe, invitation.

    Un lien expire après ``VALIDITY`` et ne sert qu'une fois. Seule l'empreinte du jeton
    est conservée : une copie de la base ne permet pas de reconstituer les liens.
    """

    VALIDITY = None  # timedelta, défini par chaque type de lien

    token_digest = models.CharField('empreinte du jeton', max_length=64, unique=True, editable=False)
    created_at = models.DateTimeField('créé le', auto_now_add=True)
    expires_at = models.DateTimeField('expire le')
    used_at = models.DateTimeField('utilisé le', null=True, blank=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']

    @classmethod
    def create_with_token(cls, **fields):
        """Crée un lien ; renvoie (lien, jeton). Le jeton n'est pas conservé."""
        token, digest = new_token()
        link = cls.objects.create(token_digest=digest, expires_at=timezone.now() + cls.VALIDITY, **fields)
        return link, token

    @classmethod
    def lookup(cls, token):
        """Lien correspondant au jeton, qu'il soit encore valable ou non ; None si inconnu."""
        if not token:
            return None
        return cls.objects.filter(token_digest=token_digest(token)).first()

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_used(self):
        return self.used_at is not None

    @property
    def is_valid(self):
        return not self.is_used and not self.is_expired

    def mark_used(self):
        """Consomme le lien. Renvoie False s'il était déjà utilisé ou expiré (même en cas d'accès simultanés)."""
        now = timezone.now()
        updated = type(self).objects.filter(pk=self.pk, used_at__isnull=True, expires_at__gt=now).update(used_at=now)
        if updated:
            self.used_at = now
        return bool(updated)
