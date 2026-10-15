from django.contrib.auth.models import AbstractUser, BaseUserManager
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

    @property
    def is_bureau(self):
        """Le bureau exécutif réunit les coordonnateurs et les fondateurs."""
        return self.role in (self.Role.COORDONNATEUR, self.Role.FONDATEUR)
