from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Territory


def territory_path(territory):
    """Chemin lisible d'un territoire : « Sénégal › Saint-Louis › Podor »."""
    names = []
    while territory is not None:
        names.append(territory.name)
        territory = territory.parent
    return ' › '.join(reversed(names))


class TerritorySummarySerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    path = serializers.SerializerMethodField(help_text='Exemple : « Sénégal › Saint-Louis › Podor ».')

    class Meta:
        model = Territory
        fields = ('id', 'name', 'kind', 'kind_label', 'path')

    def get_path(self, territory):
        return territory_path(territory)


class ManagedTerritorySerializer(TerritorySummarySerializer):
    """Territoire vu depuis le bureau : avec son rattachement et son état."""

    class Meta(TerritorySummarySerializer.Meta):
        fields = TerritorySummarySerializer.Meta.fields + ('parent', 'is_active')


class TerritoryUsageSerializer(ManagedTerritorySerializer):
    """Territoire du bureau avec ce qu'il contient : ce qui décide s'il peut être supprimé."""

    members_count = serializers.IntegerField(read_only=True, help_text='Membres rattachés à ce territoire.')
    coordinators_count = serializers.IntegerField(read_only=True, help_text='Membres du bureau rattachés.')
    programs_count = serializers.IntegerField(read_only=True)
    applications_count = serializers.IntegerField(read_only=True, help_text="Demandes d'adhésion qui le visent.")
    children_count = serializers.IntegerField(read_only=True, help_text='Territoires qui y sont rattachés.')
    deletable = serializers.SerializerMethodField(help_text='Vide : rien ni personne ne s’y rattache.')

    class Meta(ManagedTerritorySerializer.Meta):
        fields = ManagedTerritorySerializer.Meta.fields + (
            'members_count',
            'coordinators_count',
            'programs_count',
            'applications_count',
            'children_count',
            'deletable',
        )

    def get_deletable(self, territory):
        return not any(
            getattr(territory, name)
            for name in (
                'members_count', 'coordinators_count', 'programs_count', 'applications_count', 'children_count'
            )
        )


class TerritoryWriteSerializer(serializers.ModelSerializer):
    """Ajouter, renommer, rattacher ou désactiver un territoire (fondateurs).

    La hiérarchie (commune › région › pays) est vérifiée par le modèle ; ses messages
    sont renvoyés tels quels au formulaire.
    """

    class Meta:
        model = Territory
        fields = ('name', 'kind', 'parent', 'is_active')
        # Les contraintes d'unicité sont vérifiées dans validate(), avec un message en français.
        validators = []

    def validate_name(self, value):
        value = ' '.join(value.split())
        if not value:
            raise serializers.ValidationError('Indiquez le nom du territoire.')
        return value

    def validate(self, attrs):
        instance = self.instance or Territory()
        for field, value in attrs.items():
            setattr(instance, field, value)
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.message_dict)
        same_name = Territory.objects.filter(name__iexact=instance.name, parent_id=instance.parent_id)
        if instance.pk:
            same_name = same_name.exclude(pk=instance.pk)
        if same_name.exists():
            raise serializers.ValidationError({'name': 'Un territoire porte déjà ce nom à cet endroit.'})
        return attrs
