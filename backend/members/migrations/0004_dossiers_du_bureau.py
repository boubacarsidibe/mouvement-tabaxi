from django.db import migrations


def create_missing_files(apps, schema_editor):
    """Donne un dossier de membre aux comptes du bureau qui n'en ont pas (fondateur créé avant le dossier).

    Les comptes invités qui n'ont pas encore choisi leur mot de passe n'en reçoivent pas : leur dossier
    est ouvert à l'acceptation de l'invitation.
    """
    User = apps.get_model('accounts', 'User')
    Member = apps.get_model('members', 'Member')
    users = (
        User.objects.filter(role__in=['coordonnateur', 'fondateur'], member__isnull=True)
        .exclude(password='')
        .exclude(password__startswith='!')  # mot de passe inutilisable : invitation en attente
    )
    for user in users:
        member = Member.objects.create(user=user, joined_on=user.date_joined.date())
        number = f'TBX-{member.joined_on.year}-{member.pk:05d}'
        Member.objects.filter(pk=member.pk).update(number=number)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_liens_de_compte'),
        ('members', '0003_statut_du_membre'),
    ]

    operations = [
        migrations.RunPython(create_missing_files, migrations.RunPython.noop),
    ]
