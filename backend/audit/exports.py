"""Export d'une liste en fichier Excel, noté dans le journal des actions.

Le fichier contient exactement la liste filtrée que la personne consulte (mêmes filtres, même
périmètre, même ordre). La ligne de journal est écrite dans la même transaction que le fichier :
pas de fichier sans trace, pas de trace sans fichier.
"""

from django.db import transaction

from core.xlsx import build_workbook, dated_filename, xlsx_response

from .models import AuditEntry
from .services import record


def export_list(request, *, base_name, subject, headers, rows, filters):
    """Réponse de téléchargement d'un fichier Excel, après avoir inscrit l'export au journal."""
    rows = list(rows)
    filename = dated_filename(base_name)
    with transaction.atomic():
        content = build_workbook(subject, headers, rows)
        record(
            AuditEntry.Action.LIST_EXPORTED,
            actor=request.user,
            subject=subject,
            rows=len(rows),
            filters=filters,
            file=filename,
        )
    return xlsx_response(filename, content)
