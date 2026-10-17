from django.db import models


class StoredFile(models.Model):
    """Fichier envoyé (photo de profil) conservé en base, chiffré.

    Sert d'espace de stockage quand le serveur n'a pas de disque durable (hébergement
    sans serveur comme Vercel). Voir core/storage.py.
    """

    name = models.CharField('nom', max_length=255, unique=True)
    content = models.BinaryField('contenu chiffré')
    size = models.PositiveIntegerField('taille (octets)')
    created_at = models.DateTimeField('créé le', auto_now_add=True)

    class Meta:
        verbose_name = 'fichier stocké'
        verbose_name_plural = 'fichiers stockés'

    def __str__(self):
        return self.name
