"""Territoires de départ : le Sénégal, ses 14 régions et une première liste de communes.

Les communes chargées sont les chefs-lieux des 46 départements, plus Touba.
Les fondateurs complètent ou corrigent la liste depuis l'administration.
"""

from django.db import migrations

PAYS = 'Sénégal'

COMMUNES_PAR_REGION = {
    'Dakar': ['Dakar', 'Guédiawaye', 'Keur Massar', 'Pikine', 'Rufisque'],
    'Diourbel': ['Bambey', 'Diourbel', 'Mbacké', 'Touba'],
    'Fatick': ['Fatick', 'Foundiougne', 'Gossas'],
    'Kaffrine': ['Birkelane', 'Kaffrine', 'Koungheul', 'Malem-Hodar'],
    'Kaolack': ['Guinguinéo', 'Kaolack', 'Nioro du Rip'],
    'Kédougou': ['Kédougou', 'Salémata', 'Saraya'],
    'Kolda': ['Kolda', 'Médina Yoro Foulah', 'Vélingara'],
    'Louga': ['Kébémer', 'Linguère', 'Louga'],
    'Matam': ['Kanel', 'Matam', 'Ranérou'],
    'Saint-Louis': ['Dagana', 'Podor', 'Saint-Louis'],
    'Sédhiou': ['Bounkiling', 'Goudomp', 'Sédhiou'],
    'Tambacounda': ['Bakel', 'Goudiry', 'Koumpentoum', 'Tambacounda'],
    'Thiès': ['Mbour', 'Thiès', 'Tivaouane'],
    'Ziguinchor': ['Bignona', 'Oussouye', 'Ziguinchor'],
}


def charger(apps, schema_editor):
    # Le modèle historique n'a pas la méthode save() du modèle réel : la hiérarchie
    # est écrite ici directement, dans le bon ordre.
    Territory = apps.get_model('territories', 'Territory')
    pays, _ = Territory.objects.get_or_create(name=PAYS, parent=None, defaults={'kind': 'pays'})
    for region_name, communes in COMMUNES_PAR_REGION.items():
        region, _ = Territory.objects.get_or_create(name=region_name, parent=pays, defaults={'kind': 'region'})
        for commune_name in communes:
            Territory.objects.get_or_create(name=commune_name, parent=region, defaults={'kind': 'commune'})


class Migration(migrations.Migration):

    dependencies = [
        ('territories', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(charger, migrations.RunPython.noop),
    ]
