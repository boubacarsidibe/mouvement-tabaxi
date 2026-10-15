from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
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


PASSWORDS_DIFFER = 'Les deux mots de passe ne correspondent pas.'


def check_new_password(password, confirmation, user, field='password', confirm_field='password_confirm'):
    """Règles d'un nouveau mot de passe : confirmation identique et règles de sécurité de Django.

    10 caractères au moins, pas seulement des chiffres, pas un mot de passe courant, pas
    semblable au nom ou au courriel de la personne. Les messages sont en français.
    """
    if password != confirmation:
        raise serializers.ValidationError({confirm_field: [PASSWORDS_DIFFER]})
    try:
        validate_password(password, user=user)
    except DjangoValidationError as error:
        raise serializers.ValidationError({field: error.messages})


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(label='courriel')


class TokenSerializer(serializers.Serializer):
    token = serializers.CharField(label='jeton')


class PasswordResetSerializer(TokenSerializer):
    password = serializers.CharField(label='nouveau mot de passe', trim_whitespace=False)
    password_confirm = serializers.CharField(label='confirmation', trim_whitespace=False)

    def validate(self, data):
        check_new_password(data['password'], data['password_confirm'], self.context['user'])
        return data


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(label='mot de passe actuel', trim_whitespace=False)
    new_password = serializers.CharField(label='nouveau mot de passe', trim_whitespace=False)
    new_password_confirm = serializers.CharField(label='confirmation', trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context['user'].check_password(value):
            raise serializers.ValidationError('Le mot de passe actuel est incorrect.')
        return value

    def validate(self, data):
        check_new_password(
            data['new_password'], data['new_password_confirm'], self.context['user'],
            field='new_password', confirm_field='new_password_confirm',
        )
        return data
