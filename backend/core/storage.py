"""Stockage des fichiers envoyés dans la base de données, chiffrés.

Sur un hébergement sans disque durable (Vercel), un fichier écrit sur le disque
disparaît. Les photos de profil, petites (JPEG de 800 pixels au plus), sont donc
gardées en base, chiffrées comme les autres données sensibles. Activé par
``DJANGO_FILE_STORAGE=database``.
"""

from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible

from . import crypto


@deconstructible
class DatabaseStorage(Storage):
    def _model(self):
        from .models import StoredFile

        return StoredFile

    def _open(self, name, mode='rb'):
        stored = self._model().objects.filter(name=name).first()
        if stored is None:
            raise FileNotFoundError(name)
        data = crypto.fernet().decrypt(bytes(stored.content))
        return ContentFile(data, name=name)

    def _save(self, name, content):
        content.seek(0)
        data = content.read()
        if isinstance(data, str):
            data = data.encode('utf-8')
        self._model().objects.create(name=name, content=crypto.fernet().encrypt(data), size=len(data))
        return name

    def delete(self, name):
        self._model().objects.filter(name=name).delete()

    def exists(self, name):
        return self._model().objects.filter(name=name).exists()

    def size(self, name):
        stored = self._model().objects.filter(name=name).values_list('size', flat=True).first()
        if stored is None:
            raise FileNotFoundError(name)
        return stored

    def url(self, name):
        # Les fichiers ne sont jamais servis directement : l'API les renvoie après contrôle d'accès.
        raise NotImplementedError("Les fichiers sont servis par l'API, pas par une adresse publique.")
