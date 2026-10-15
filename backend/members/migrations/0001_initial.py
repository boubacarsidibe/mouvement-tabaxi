# Generated manually for the first member profile model.

import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('applications', '0003_lien_personnel'),
        ('territories', '0002_territoires_de_depart'),
    ]

    operations = [
        migrations.CreateModel(
            name='Member',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('membership_number', models.CharField(editable=False, max_length=24, null=True, unique=True, verbose_name='numéro de membre')),
                ('address', models.CharField(max_length=300, verbose_name='adresse complète')),
                ('photo', models.FileField(upload_to='members/photos/%Y/%m/', validators=[django.core.validators.FileExtensionValidator(['jpg', 'jpeg', 'png', 'webp'])], verbose_name='photo')),
                ('status', models.CharField(choices=[('actif', 'Actif'), ('suspendu', 'Suspendu'), ('radie', 'Radié')], db_index=True, default='actif', max_length=12, verbose_name='statut')),
                ('joined_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name="date d'adhésion")),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='modifié le')),
                ('application', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='member', to='applications.application', verbose_name="demande d'adhésion")),
                ('territory', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='members', to='territories.territory', verbose_name='territoire')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='member_profile', to=settings.AUTH_USER_MODEL, verbose_name='compte')),
            ],
            options={
                'verbose_name': 'membre',
                'verbose_name_plural': 'membres',
                'ordering': ['user__last_name', 'user__first_name', 'id'],
            },
        ),
    ]
