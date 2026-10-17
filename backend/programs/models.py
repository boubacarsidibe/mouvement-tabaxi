from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from core.fields import public_id_field


class Program(models.Model):
    """Programme d'un territoire : objectif, responsable, période et état.

    Un programme ne se supprime pas (il garde sa mémoire) : on le passe à « Annulé » ou « Terminé ».
    Le territoire d'un programme ne peut pas être supprimé tant que le programme existe.
    """

    class Status(models.TextChoices):
        PLANNED = 'prevu', 'Prévu'
        ONGOING = 'en_cours', 'En cours'
        DONE = 'termine', 'Terminé'
        CANCELLED = 'annule', 'Annulé'

    # Un membre voit les programmes qui se déroulent ou vont se dérouler, pas ceux qui sont annulés.
    OPEN = (Status.PLANNED, Status.ONGOING)

    public_id = public_id_field()
    name = models.CharField('nom', max_length=150)
    objective = models.TextField('objectif', max_length=2000)
    territory = models.ForeignKey(
        'territories.Territory', verbose_name='territoire concerné', on_delete=models.PROTECT, related_name='programs'
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='responsable',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='managed_programs',
    )
    start_date = models.DateField('début')
    end_date = models.DateField('fin')
    status = models.CharField('état', max_length=20, choices=Status.choices, default=Status.PLANNED, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='créé par',
        on_delete=models.PROTECT,
        null=True,
        related_name='created_programs',
    )
    created_at = models.DateTimeField('créé le', auto_now_add=True)
    updated_at = models.DateTimeField('modifié le', auto_now=True)

    class Meta:
        verbose_name = 'programme'
        ordering = ['-start_date', '-id']
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__gte=F('start_date')),
                name='programme_fin_apres_debut',
                violation_error_message='La date de fin doit être égale ou postérieure à la date de début.',
            ),
        ]

    def __str__(self):
        return self.name


class Activity(models.Model):
    """Activité d'un programme : titre, date, lieu, description, puis compte rendu et présences."""

    public_id = public_id_field()
    program = models.ForeignKey(Program, verbose_name='programme', on_delete=models.PROTECT, related_name='activities')
    title = models.CharField('titre', max_length=150)
    starts_at = models.DateTimeField('début')
    ends_at = models.DateTimeField('fin', null=True, blank=True)
    place = models.CharField('lieu', max_length=200)
    description = models.TextField('description', max_length=2000)

    # Compte rendu écrit après l'activité, visible par le bureau du territoire.
    report = models.TextField('compte rendu', max_length=5000, blank=True)
    report_author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='compte rendu écrit par',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='activity_reports',
    )
    reported_at = models.DateTimeField('compte rendu écrit le', null=True, blank=True)

    # La liste des présences est « notée » dès qu'elle est enregistrée, même sans aucun présent.
    attendance_noted_at = models.DateTimeField('présences notées le', null=True, blank=True)
    attendance_noted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='présences notées par',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='attendance_lists',
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='créée par',
        on_delete=models.PROTECT,
        null=True,
        related_name='created_activities',
    )
    created_at = models.DateTimeField('créée le', auto_now_add=True)
    updated_at = models.DateTimeField('modifiée le', auto_now=True)

    class Meta:
        verbose_name = 'activité'
        ordering = ['starts_at', 'id']
        constraints = [
            models.CheckConstraint(
                condition=Q(ends_at__isnull=True) | Q(ends_at__gte=F('starts_at')),
                name='activite_fin_apres_debut',
                violation_error_message="L'heure de fin doit suivre l'heure de début.",
            ),
        ]

    def __str__(self):
        return f'{self.title} ({timezone.localtime(self.starts_at):%d/%m/%Y})'

    @property
    def has_started(self):
        return self.starts_at <= timezone.now()

    @property
    def is_over(self):
        """Terminée : l'heure de fin est passée, ou à défaut la journée de l'activité est écoulée."""
        now = timezone.now()
        if self.ends_at:
            return self.ends_at <= now
        return timezone.localtime(self.starts_at).date() < timezone.localdate(now)


class Registration(models.Model):
    """Inscription d'un membre à une activité : il s'inscrit et se désinscrit lui-même."""

    activity = models.ForeignKey(Activity, verbose_name='activité', on_delete=models.PROTECT, related_name='registrations')
    member = models.ForeignKey(
        'members.Member', verbose_name='membre', on_delete=models.PROTECT, related_name='registrations'
    )
    created_at = models.DateTimeField('inscrit le', auto_now_add=True)

    class Meta:
        verbose_name = 'inscription'
        ordering = ['created_at', 'id']
        constraints = [
            models.UniqueConstraint(fields=['activity', 'member'], name='inscription_unique_par_activite'),
        ]

    def __str__(self):
        return f'{self.member} → {self.activity}'


class Attendance(models.Model):
    """Présence d'un membre à une activité, notée par le bureau."""

    activity = models.ForeignKey(Activity, verbose_name='activité', on_delete=models.PROTECT, related_name='attendances')
    member = models.ForeignKey(
        'members.Member', verbose_name='membre', on_delete=models.PROTECT, related_name='attendances'
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name='noté par', on_delete=models.PROTECT, related_name='recorded_attendances'
    )
    recorded_at = models.DateTimeField('noté le', auto_now_add=True)

    class Meta:
        verbose_name = 'présence'
        ordering = ['member__user__last_name', 'member__user__first_name', 'id']
        constraints = [
            models.UniqueConstraint(fields=['activity', 'member'], name='presence_unique_par_activite'),
        ]

    def __str__(self):
        return f'{self.member} présent à {self.activity}'
