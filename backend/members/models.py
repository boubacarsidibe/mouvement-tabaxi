from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import models, transaction
from django.utils import timezone


class Member(models.Model):
    """Profil civil d'un membre, distinct de son compte de connexion."""

    class Status(models.TextChoices):
        ACTIF = 'actif', 'Actif'
        SUSPENDU = 'suspendu', 'Suspendu'
        RADIE = 'radie', 'Radié'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        verbose_name='compte',
        on_delete=models.CASCADE,
        related_name='member_profile',
    )
    application = models.OneToOneField(
        'applications.Application',
        verbose_name="demande d'adhésion",
        on_delete=models.PROTECT,
        related_name='member',
    )
    territory = models.ForeignKey(
        'territories.Territory',
        verbose_name='territoire',
        on_delete=models.PROTECT,
        related_name='members',
    )
    membership_number = models.CharField('numéro de membre', max_length=24, unique=True, null=True, editable=False)
    address = models.CharField('adresse complète', max_length=300)
    photo = models.FileField(
        'photo',
        upload_to='members/photos/%Y/%m/',
        validators=[FileExtensionValidator(['jpg', 'jpeg', 'png', 'webp'])],
    )
    status = models.CharField('statut', max_length=12, choices=Status.choices, default=Status.ACTIF, db_index=True)
    joined_at = models.DateTimeField("date d'adhésion", default=timezone.now)
    updated_at = models.DateTimeField('modifié le', auto_now=True)

    class Meta:
        verbose_name = 'membre'
        verbose_name_plural = 'membres'
        ordering = ['user__last_name', 'user__first_name', 'id']

    def __str__(self):
        return f'{self.membership_number or "Nouveau membre"} – {self.user.get_full_name()}'

    def save(self, *args, **kwargs):
        with transaction.atomic():
            super().save(*args, **kwargs)
            if not self.membership_number:
                year = timezone.localtime(self.joined_at).year
                self.membership_number = f'TBX-{year}-{self.pk:05d}'
                type(self).objects.filter(pk=self.pk).update(membership_number=self.membership_number)
