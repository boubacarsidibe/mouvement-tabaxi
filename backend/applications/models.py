from django.conf import settings
from django.db import models, transaction
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone


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
