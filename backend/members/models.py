from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class Member(models.Model):
    """Fiche d'adhérent d'un compte : numéro de membre et date d'adhésion.

    Le numéro TBX-AAAA-NNNNN est attribué automatiquement à la création : année
    d'adhésion et numéro d'ordre unique, jamais réutilisé, même après une radiation.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, verbose_name='compte', on_delete=models.PROTECT, related_name='member'
    )
    number = models.CharField('numéro de membre', max_length=20, unique=True, null=True, editable=False)
    joined_on = models.DateField("date d'adhésion", default=timezone.localdate)
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
