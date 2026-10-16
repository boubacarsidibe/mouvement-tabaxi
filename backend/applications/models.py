from datetime import timedelta

from django.conf import settings
from django.db import models, transaction
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone

from core.tokens import new_token, token_digest


class Application(models.Model):
    """Demande d'adhésion déposée par un visiteur, sans compte."""

    class Status(models.TextChoices):
        A_EXAMINER = 'a_examiner', 'À examiner'
        ACCEPTEE = 'acceptee', 'Acceptée'
        REJETEE = 'rejetee', 'Rejetée'
        INSCRITE = 'inscrite', 'Inscrite'

    # Une demande est « en cours » tant que la personne n'est ni refusée ni inscrite.
    IN_PROGRESS = (Status.A_EXAMINER, Status.ACCEPTEE)

    reference = models.CharField('référence', max_length=20, unique=True, null=True, editable=False)
    first_name = models.CharField('prénom', max_length=150)
    last_name = models.CharField('nom', max_length=150)
    email = models.EmailField('courriel')
    territory = models.ForeignKey(
        'territories.Territory', verbose_name='localité souhaitée', on_delete=models.PROTECT, related_name='applications'
    )
    profession = models.CharField('profession', max_length=120)
    motivation = models.TextField('motivation', max_length=2000)
    consent_at = models.DateTimeField('consentement donné le')
    status = models.CharField('statut', max_length=20, choices=Status.choices, default=Status.A_EXAMINER, db_index=True)
    created_at = models.DateTimeField('déposée le', auto_now_add=True)
    updated_at = models.DateTimeField('modifiée le', auto_now=True)

    # Décision du fondateur : qui, quand, et pourquoi en cas de refus.
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='décision prise par',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='decided_applications',
    )
    decided_at = models.DateTimeField('décision prise le', null=True, blank=True)
    rejection_reason = models.TextField('motif du refus', blank=True)
    internal_note = models.TextField('note interne', blank=True, help_text='Visible par les fondateurs seulement.')

    class Meta:
        verbose_name = "demande d'adhésion"
        verbose_name_plural = "demandes d'adhésion"
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                Lower('email'),
                condition=Q(status__in=['a_examiner', 'acceptee']),
                name='demande_en_cours_unique_par_courriel',
                violation_error_message='Une demande est déjà en cours pour ce courriel.',
            ),
        ]

    def __str__(self):
        return f'{self.reference or "Nouvelle demande"} – {self.first_name} {self.last_name}'

    @property
    def is_in_progress(self):
        return self.status in self.IN_PROGRESS

    def save(self, *args, **kwargs):
        # La référence TAB-AAAA-NNNNN reprend l'année de dépôt et le numéro unique de la demande.
        with transaction.atomic():
            super().save(*args, **kwargs)
            if not self.reference:
                year = timezone.localtime(self.created_at).year
                self.reference = f'TAB-{year}-{self.pk:05d}'
                type(self).objects.filter(pk=self.pk).update(reference=self.reference)


class RegistrationLink(models.Model):
    """Lien personnel envoyé à l'acceptation, pour finaliser l'inscription.

    Valable 7 jours et utilisable une seule fois. Seule l'empreinte du jeton est
    conservée : une copie de la base ne permet pas de reconstituer les liens.
    """

    VALIDITY = timedelta(days=7)

    application = models.ForeignKey(
        Application, verbose_name='demande', on_delete=models.CASCADE, related_name='registration_links'
    )
    token_digest = models.CharField('empreinte du jeton', max_length=64, unique=True, editable=False)
    created_at = models.DateTimeField('créé le', auto_now_add=True)
    expires_at = models.DateTimeField('expire le')
    used_at = models.DateTimeField('utilisé le', null=True, blank=True)

    class Meta:
        verbose_name = "lien personnel d'inscription"
        verbose_name_plural = "liens personnels d'inscription"
        ordering = ['-created_at']

    def __str__(self):
        return f'Lien pour {self.application}'

    @classmethod
    def issue(cls, application):
        """Crée un lien pour la demande ; renvoie (lien, jeton). Le jeton n'est pas conservé."""
        token, digest = new_token()
        link = cls.objects.create(application=application, token_digest=digest, expires_at=timezone.now() + cls.VALIDITY)
        return link, token

    @classmethod
    def find(cls, token):
        """Lien correspondant au jeton, qu'il soit encore valable ou non ; None si inconnu."""
        return cls.objects.select_related('application').filter(token_digest=token_digest(token)).first()

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
