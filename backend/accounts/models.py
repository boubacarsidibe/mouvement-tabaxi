from datetime import timedelta

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from core.tokens import new_token, token_digest


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
        user = self._create_user(email, password, **extra)
        # Un fondateur figure dans la base des coordonnateurs et a sa carte : il lui faut un dossier de membre.
        from members.models import Member

        Member.objects.get_or_create(user=user)
        return user

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
    # createsuperuser demande aussi le prénom et le nom (carte de membre, en-têtes).
    REQUIRED_FIELDS = ['first_name', 'last_name']

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


class PasswordResetLink(models.Model):
    """Lien personnel de réinitialisation du mot de passe : valable une heure, utilisable une fois.

    Seule l'empreinte du jeton est conservée : une copie de la base ne permet pas de
    reconstituer les liens.
    """

    VALIDITY = timedelta(hours=1)

    user = models.ForeignKey(User, verbose_name='compte', on_delete=models.CASCADE, related_name='reset_links')
    token_digest = models.CharField('empreinte du jeton', max_length=64, unique=True, editable=False)
    created_at = models.DateTimeField('créé le', auto_now_add=True)
    expires_at = models.DateTimeField('expire le')
    used_at = models.DateTimeField('utilisé le', null=True, blank=True)

    class Meta:
        verbose_name = 'lien de réinitialisation du mot de passe'
        verbose_name_plural = 'liens de réinitialisation du mot de passe'
        ordering = ['-created_at']

    def __str__(self):
        return f'Réinitialisation pour {self.user}'

    @classmethod
    def issue(cls, user):
        """Crée un lien ; les précédents cessent de fonctionner. Renvoie (lien, jeton)."""
        now = timezone.now()
        cls.objects.filter(user=user, used_at__isnull=True, expires_at__gt=now).update(expires_at=now)
        token, digest = new_token()
        return cls.objects.create(user=user, token_digest=digest, expires_at=now + cls.VALIDITY), token

    @classmethod
    def find(cls, token):
        return cls.objects.select_related('user').filter(token_digest=token_digest(token)).first()

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_used(self):
        return self.used_at is not None

    def mark_used(self):
        """Consomme le lien ; False s'il était déjà utilisé ou expiré (même en accès simultanés)."""
        now = timezone.now()
        updated = type(self).objects.filter(pk=self.pk, used_at__isnull=True, expires_at__gt=now).update(used_at=now)
        if updated:
            self.used_at = now
        return bool(updated)


class InvitationLink(models.Model):
    """Invitation au bureau exécutif : lien personnel valable 7 jours, utilisable une fois."""

    VALIDITY = timedelta(days=7)

    user = models.ForeignKey(User, verbose_name='compte invité', on_delete=models.CASCADE, related_name='invitations')
    invited_by = models.ForeignKey(
        User, verbose_name='invité par', on_delete=models.PROTECT, null=True, related_name='invitations_sent'
    )
    token_digest = models.CharField('empreinte du jeton', max_length=64, unique=True, editable=False)
    created_at = models.DateTimeField('créée le', auto_now_add=True)
    expires_at = models.DateTimeField('expire le')
    used_at = models.DateTimeField('utilisée le', null=True, blank=True)

    class Meta:
        verbose_name = 'invitation au bureau'
        verbose_name_plural = 'invitations au bureau'
        ordering = ['-created_at']

    def __str__(self):
        return f'Invitation de {self.user}'

    @classmethod
    def issue(cls, user, invited_by):
        token, digest = new_token()
        link = cls.objects.create(
            user=user, invited_by=invited_by, token_digest=digest, expires_at=timezone.now() + cls.VALIDITY
        )
        return link, token

    @classmethod
    def find(cls, token):
        return cls.objects.select_related('user', 'user__territory').filter(token_digest=token_digest(token)).first()

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_used(self):
        return self.used_at is not None

    def mark_used(self):
        now = timezone.now()
        updated = type(self).objects.filter(pk=self.pk, used_at__isnull=True, expires_at__gt=now).update(used_at=now)
        if updated:
            self.used_at = now
        return bool(updated)


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
