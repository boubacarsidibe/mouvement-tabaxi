from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from core.append_only import AppendOnlyModel
from core.fields import EncryptedTextField


class Member(models.Model):
    """Fiche d'adhérent d'un compte : numéro, date d'adhésion, coordonnées, photo.

    Le numéro TBX-AAAA-NNNNN est attribué automatiquement à la création : année
    d'adhésion et numéro d'ordre unique, jamais réutilisé, même après une radiation.
    L'adresse et le téléphone sont chiffrés en base.

    Le statut (actif, suspendu, radié) se change par ``members.status.change_status`` : il
    désactive ou réactive le compte et ajoute une ligne à l'historique. Un membre n'est
    jamais supprimé.
    """

    class Status(models.TextChoices):
        ACTIF = 'actif', 'Actif'
        SUSPENDU = 'suspendu', 'Suspendu'
        RADIE = 'radie', 'Radié'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, verbose_name='compte', on_delete=models.PROTECT, related_name='member'
    )
    number = models.CharField('numéro de membre', max_length=20, unique=True, null=True, editable=False)
    joined_on = models.DateField("date d'adhésion", default=timezone.localdate)
    address = EncryptedTextField('adresse', max_length=255, blank=True)
    phone = EncryptedTextField('téléphone', max_length=30, blank=True)
    # Photos hors du dossier public : elles ne sont servies qu'à travers l'API, après contrôle d'accès.
    photo = models.FileField('photo', upload_to='photos/', blank=True)
    application = models.OneToOneField(
        'applications.Application',
        verbose_name="demande d'adhésion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='member',
    )
    status = models.CharField('statut', max_length=20, choices=Status.choices, default=Status.ACTIF, db_index=True)
    rules_accepted_at = models.DateTimeField('statuts et règlement acceptés le', null=True, blank=True)
    created_at = models.DateTimeField('créée le', auto_now_add=True)
    updated_at = models.DateTimeField('modifiée le', auto_now=True)

    class Meta:
        verbose_name = 'membre'
        ordering = ['-joined_on', '-id']

    def __str__(self):
        return f'{self.number or "Nouveau membre"} – {self.user.get_full_name() or self.user.email}'

    def save(self, *args, **kwargs):
        with transaction.atomic():
            super().save(*args, **kwargs)
            if not self.number:
                self.number = f'TBX-{self.joined_on.year}-{self.pk:05d}'
                type(self).objects.filter(pk=self.pk).update(number=self.number)


class MemberStatusChange(AppendOnlyModel):
    """Historique des changements de statut : qui, quand, de quel statut à quel statut, pourquoi.

    Les lignes ne se modifient ni ne se suppriment : le statut actuel est dans ``Member``,
    tout le passé est ici.
    """

    member = models.ForeignKey(
        Member, verbose_name='membre', on_delete=models.PROTECT, related_name='status_changes'
    )
    from_status = models.CharField('ancien statut', max_length=20, choices=Member.Status.choices)
    to_status = models.CharField('nouveau statut', max_length=20, choices=Member.Status.choices)
    reason = models.TextField('motif', blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='changé par',
        on_delete=models.PROTECT,
        null=True,
        related_name='member_status_changes',
    )
    changed_at = models.DateTimeField('changé le', auto_now_add=True)

    class Meta:
        verbose_name = 'changement de statut'
        verbose_name_plural = 'changements de statut'
        ordering = ['-changed_at', '-id']

    def __str__(self):
        return f'{self.member.number} : {self.get_from_status_display()} → {self.get_to_status_display()}'
