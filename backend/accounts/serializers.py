from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Utilisateur connecté, tel que le frontend en a besoin pour choisir l'interface."""

    role_label = serializers.CharField(source='get_role_display', read_only=True)
    is_bureau = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'role', 'role_label', 'is_bureau')
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


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(label='courriel')


class TokenSerializer(serializers.Serializer):
    token = serializers.CharField(label='jeton')


class PasswordResetSerializer(TokenSerializer):
    password = serializers.CharField(label='nouveau mot de passe', trim_whitespace=False)
    password_confirm = serializers.CharField(label='confirmation', trim_whitespace=False)

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': [PASSWORDS_DIFFER]})
        try:
            validate_password(data['password'], user=self.context['user'])
        except DjangoValidationError as error:
            raise serializers.ValidationError({'password': error.messages})
        return data
