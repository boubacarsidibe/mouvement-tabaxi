from django.conf import settings
from django.db import models

from core.append_only import AppendOnlyModel
from core.fields import EncryptedJSONField


class AuditEntry(AppendOnlyModel):
    """Une ligne du journal : qui a fait quoi, à propos de qui ou de quoi, et quand.

    Le journal ne se modifie ni ne s'efface (``core.append_only``) : pas d'écran, de route ni
    d'action d'administration qui le permette, et le code lui-même le refuse. L'auteur est
    gardé avec son nom du moment, pour que la ligne reste lisible même si le compte change.
    """

    class Action(models.TextChoices):
        APPLICATION_ACCEPTED = 'demande_acceptee', 'Demande acceptée'
        APPLICATION_REJECTED = 'demande_refusee', 'Demande refusée'
        LINK_RESENT = 'lien_renvoye', "Lien d'inscription renvoyé"
        STATUS_CHANGED = 'statut_modifie', 'Statut modifié'
        INVITATION_SENT = 'invitation_envoyee', 'Invitation envoyée'
        LIST_EXPORTED = 'liste_exportee', 'Liste exportée'

    # Rubrique affichée à côté de chaque action.
    CATEGORIES = {
        Action.APPLICATION_ACCEPTED: ('adhesion', 'Adhésion'),
        Action.APPLICATION_REJECTED: ('adhesion', 'Adhésion'),
        Action.LINK_RESENT: ('adhesion', 'Adhésion'),
        Action.STATUS_CHANGED: ('membres', 'Membres'),
        Action.INVITATION_SENT: ('acces', 'Accès'),
        Action.LIST_EXPORTED: ('export', 'Export'),
    }

    action = models.CharField('action', max_length=30, choices=Action.choices, db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='auteur',
        on_delete=models.PROTECT,
        null=True,
        related_name='audit_entries',
    )
    actor_name = models.CharField("nom de l'auteur", max_length=255)
    subject = models.CharField('concerne', max_length=255, help_text='Personne ou liste concernée.')
    # Chiffrés en base : ils contiennent des motifs de refus ou de suspension.
    details = EncryptedJSONField('détails', default=dict, blank=True)
    created_at = models.DateTimeField('date', auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'action du journal'
        verbose_name_plural = 'journal des actions'
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f'{self.created_at:%d/%m/%Y %H:%M} · {self.get_action_display()} · {self.subject}'

    @property
    def category(self):
        return self.CATEGORIES[self.action]
