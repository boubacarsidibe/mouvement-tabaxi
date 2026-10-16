"""Point d'entrée de l'API Django sur Vercel (fonction Python).

Vercel appelle l'application WSGI ``app`` ; toutes les adresses /api/, /admin/ et /static/
y sont renvoyées par vercel.json. Le code du serveur reste dans backend/.
"""

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / 'backend'
sys.path.insert(0, str(BACKEND))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from django.core.wsgi import get_wsgi_application  # noqa: E402

app = get_wsgi_application()
