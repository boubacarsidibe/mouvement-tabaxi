from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Le courriel est obligatoire.")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('role', User.Role.FONDATEUR)
        return self._create_user(email, password, **extra)

    def get_by_natural_key(self, email):
        # « Awa.Ndiaye@… » et « awa.ndiaye@… » désignent le même compte.
        return self.get(email__iexact=email)


class User(AbstractUser):
    """Compte unique pour tous les rôles : connexion par courriel et mot de passe."""

    class Role(models.TextChoices):
        MEMBRE = 'membre', 'Membre simple'
        COORDONNATEUR = 'coordonnateur', 'Coordonnateur'
        FONDATEUR = 'fondateur', 'Membre fondateur'

    username = None
    email = models.EmailField('courriel', unique=True)
    role = models.CharField('rôle', max_length=20, choices=Role.choices, default=Role.MEMBRE)
    # Territoire de rattachement d'un membre, ou territoire de coordination d'un coordonnateur.
    # Un fondateur voit tout et n'en a pas besoin.
    territory = models.ForeignKey(
        'territories.Territory',
        verbose_name='territoire',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='users',
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta(AbstractUser.Meta):
        constraints = [
            # Un courriel ne sert qu'à un seul compte, quelle que soit la casse.
            models.UniqueConstraint(
                Lower('email'), name='utilisateur_courriel_unique_sans_casse',
                violation_error_message='Un compte utilise déjà ce courriel.',
            ),
        ]

    def __str__(self):
        return self.email

    def clean(self):
        super().clean()
        if self.role == self.Role.COORDONNATEUR and self.territory_id is None:
            raise ValidationError({'territory': 'Un coordonnateur doit être rattaché à un territoire.'})

    @property
    def is_founder(self):
        return self.role == self.Role.FONDATEUR

    @property
    def is_bureau(self):
        """Le bureau exécutif réunit les coordonnateurs et les fondateurs."""
        return self.role in (self.Role.COORDONNATEUR, self.Role.FONDATEUR)


class LoginFailure(models.Model):
    """Échec de connexion, gardé quelques heures pour bloquer les essais répétés.

    Le courriel est enregistré tel que saisi (en minuscules), qu'un compte existe ou
    non : on ne doit pas pouvoir deviner un mot de passe en changeant d'adresse.
    """

    email = models.CharField('courriel saisi', max_length=254, db_index=True)
    ip_address = models.GenericIPAddressField('adresse IP', null=True, blank=True, db_index=True)
    created_at = models.DateTimeField('date', auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'échec de connexion'
        verbose_name_plural = 'échecs de connexion'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.email} – {self.created_at:%d/%m/%Y %H:%M}'
