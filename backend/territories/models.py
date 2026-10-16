from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class Territory(models.Model):
    """Territoire du mouvement : un pays, une région ou une commune.

    Les territoires sont emboîtés : une commune est rattachée à une région,
    une région à un pays. Un territoire qui contient d'autres territoires
    (ou, plus tard, des demandes, des membres, des programmes) ne peut pas
    être supprimé : on le désactive.
    """

    class Kind(models.TextChoices):
        PAYS = 'pays', 'Pays'
        REGION = 'region', 'Région'
        COMMUNE = 'commune', 'Commune'

    # Type de territoire attendu comme parent, pour chaque type.
    PARENT_KIND = {Kind.PAYS: None, Kind.REGION: Kind.PAYS, Kind.COMMUNE: Kind.REGION}

    name = models.CharField('nom', max_length=100)
    kind = models.CharField('type', max_length=10, choices=Kind.choices)
    parent = models.ForeignKey(
        'self',
        verbose_name='rattaché à',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='children',
    )
    is_active = models.BooleanField(
        'actif', default=True, help_text="Un territoire inactif n'est plus proposé dans les formulaires."
    )

    class Meta:
        verbose_name = 'territoire'
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['parent', 'name'], name='territoire_nom_unique_dans_parent'),
            models.UniqueConstraint(fields=['name'], condition=Q(parent__isnull=True), name='territoire_racine_nom_unique'),
            models.CheckConstraint(
                condition=Q(kind='pays', parent__isnull=True) | (~Q(kind='pays') & Q(parent__isnull=False)),
                name='territoire_seul_le_pays_est_sans_parent',
                violation_error_message='Seul un pays peut ne pas être rattaché à un autre territoire.',
            ),
        ]

    def __str__(self):
        return f'{self.name} ({self.get_kind_display().lower()})'

    def clean(self):
        expected = self.PARENT_KIND.get(self.kind)
        if expected is None and self.parent_id:
            raise ValidationError({'parent': "Un pays n'est rattaché à aucun territoire."})
        if expected is not None and (self.parent is None or self.parent.kind != expected):
            message = {
                self.Kind.REGION: 'Une région doit être rattachée à un pays.',
                self.Kind.COMMUNE: 'Une commune doit être rattachée à une région.',
            }[self.kind]
            raise ValidationError({'parent': message})
        if self.pk and self.children.exists():
            previous_kind = Territory.objects.filter(pk=self.pk).values_list('kind', flat=True).first()
            if previous_kind and previous_kind != self.kind:
                raise ValidationError(
                    {'kind': "Ce territoire contient d'autres territoires : son type ne peut pas changer."}
                )

    def save(self, *args, **kwargs):
        # La hiérarchie est vérifiée à chaque enregistrement, quel que soit le chemin
        # (administration, API, script).
        self.clean()
        super().save(*args, **kwargs)
