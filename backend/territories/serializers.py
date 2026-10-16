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
