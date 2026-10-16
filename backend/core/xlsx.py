"""Export d'une liste dans un fichier Excel (.xlsx).

Chaque cellule de texte est écrite comme du texte, jamais comme une formule : un nom ou un
courriel saisi par un visiteur, par exemple « =HYPERLINK(…) », s'affiche tel quel dans Excel
sans rien exécuter.
"""

import re
from datetime import date, datetime
from io import BytesIO

from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Alignment, Font

XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
DATE_FORMAT = 'DD/MM/YYYY'
DATETIME_FORMAT = 'DD/MM/YYYY HH:MM'
FORBIDDEN_IN_TITLE = re.compile(r'[\\/*?:\[\]]')


def sheet_title(title):
    """Nom d'onglet accepté par Excel : 31 caractères au plus, sans \\ / * ? : [ ]."""
    return FORBIDDEN_IN_TITLE.sub(' ', title)[:31] or 'Liste'


def _plain(value):
    """Une date et heure s'écrit à l'heure locale, sans fuseau (Excel n'en connaît pas)."""
    if isinstance(value, datetime) and timezone.is_aware(value):
        return timezone.make_naive(value)
    return value


def _cell(sheet, value, *, bold=False):
    cell = WriteOnlyCell(sheet, value=value)
    if isinstance(value, str):
        cell.data_type = 's'  # du texte, même s'il commence par « = », « + », « - » ou « @ »
    elif isinstance(value, datetime):
        cell.number_format = DATETIME_FORMAT
    elif isinstance(value, date):
        cell.number_format = DATE_FORMAT
        cell.alignment = Alignment(horizontal='left')
    if bold:
        cell.font = Font(bold=True)
    return cell


def build_workbook(title, headers, rows):
    """Fichier .xlsx (octets) : une ligne d'en-têtes en gras, puis une ligne par élément de ``rows``."""
    workbook = Workbook(write_only=True)
    sheet = workbook.create_sheet(sheet_title(title))
    for index, header in enumerate(headers):
        letter = chr(ord('A') + index)
        sheet.column_dimensions[letter].width = max(14, min(40, len(header) + 6))
    sheet.freeze_panes = 'A2'
    sheet.append([_cell(sheet, header, bold=True) for header in headers])
    for row in rows:
        sheet.append([_cell(sheet, _plain(value)) for value in row])
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def xlsx_response(filename, content):
    """Réponse de téléchargement du fichier ; jamais gardé en cache, il contient des données personnelles."""
    response = HttpResponse(content, content_type=XLSX_TYPE)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response['Cache-Control'] = 'no-store'
    return response


def dated_filename(base):
    """Nom de fichier du jour : ``membres-2026-10-16.xlsx``."""
    return f'{base}-{timezone.localdate().isoformat()}.xlsx'
