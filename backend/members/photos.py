"""Contrôle et préparation des photos de profil.

Chaque photo envoyée est vérifiée (vraie image JPG ou PNG, 5 Mo au plus), puis
réenregistrée en JPEG de 800 pixels au plus. Le réenregistrement retire toutes les
métadonnées (position GPS, appareil, date) et tout contenu caché dans le fichier.
"""

from io import BytesIO
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 5 * 1024 * 1024
MAX_SIDE = 800
ACCEPTED_FORMATS = {'JPEG', 'PNG'}
# Refuse les images « bombes » : petites en octets, gigantesques une fois décodées.
Image.MAX_IMAGE_PIXELS = 40_000_000

INVALID = 'Choisissez une photo au format JPG ou PNG.'


def prepare_photo(uploaded):
    """Renvoie la photo prête à être enregistrée, ou lève ValidationError avec un message clair."""
    if uploaded.size > MAX_BYTES:
        raise ValidationError('La photo dépasse 5 Mo. Choisissez une image plus légère.')
    try:
        with Image.open(uploaded) as probe:
            image_format = probe.format
            probe.verify()
        uploaded.seek(0)
        with Image.open(uploaded) as image:
            if image_format not in ACCEPTED_FORMATS:
                raise ValidationError(INVALID)
            image = ImageOps.exif_transpose(image)  # remet la photo à l'endroit
            image = image.convert('RGB')
            image.thumbnail((MAX_SIDE, MAX_SIDE))
            output = BytesIO()
            image.save(output, format='JPEG', quality=85, optimize=True)
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError, ValueError):
        raise ValidationError(INVALID)
    return ContentFile(output.getvalue(), name=f'{uuid4().hex}.jpg')
