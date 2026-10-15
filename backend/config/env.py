"""Lecture de la configuration locale (fichier .env)."""

import os
from pathlib import Path


def load_env_file(path):
    """Charge les variables d'un fichier .env sans écraser celles déjà définies.

    Format : une variable par ligne, ``NOM=valeur``. Les lignes vides et celles
    qui commencent par ``#`` sont ignorées ; les guillemets autour de la valeur
    sont retirés. Un fichier absent n'est pas une erreur : en production, les
    variables viennent directement de l'environnement.
    """
    try:
        lines = Path(path).read_text(encoding='utf-8').splitlines()
    except FileNotFoundError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        name, value = line.split('=', 1)
        name = name.removeprefix('export ').strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
            value = value[1:-1]
        os.environ.setdefault(name, value)
