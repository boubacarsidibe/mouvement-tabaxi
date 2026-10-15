from rest_framework import serializers

from territories.serializers import TerritorySummarySerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Utilisateur connecté, tel que le frontend en a besoin pour choisir l'interface."""

    role_label = serializers.CharField(source='get_role_display', read_only=True)
    is_bureau = serializers.BooleanField(read_only=True)
    territory = TerritorySummarySerializer(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'role', 'role_label', 'is_bureau', 'territory')
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(label='courriel')
    password = serializers.CharField(label='mot de passe', trim_whitespace=False, style={'input_type': 'password'})
    remember = serializers.BooleanField(
        label='rester connecté',
        default=False,
        help_text='Sans cette case, la session se ferme à la fermeture du navigateur.',
    )
