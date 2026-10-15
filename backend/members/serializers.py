from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import RegexValidator
from rest_framework import serializers

from accounts.models import User
from accounts.serializers import check_new_password
from territories.serializers import TerritorySummarySerializer

from .photos import prepare_photo

PHONE_FORMAT = RegexValidator(
    r'^\+?[0-9][0-9 ().-]{6,24}$',
    'Saisissez un numéro de téléphone valide, par exemple +221 77 000 00 00.',
)
RULES_REQUIRED = 'Vous devez accepter les statuts et le règlement intérieur du mouvement.'


class RegistrationLinkSerializer(serializers.Serializer):
    """Ce que la page de finalisation affiche avant que la personne ne complète son dossier."""

    first_name = serializers.CharField(source='application.first_name')
    last_name = serializers.CharField(source='application.last_name')
    email = serializers.EmailField(source='application.email')
    territory = TerritorySummarySerializer(source='application.territory')
    expires_at = serializers.DateTimeField()


class RegistrationSerializer(serializers.Serializer):
    """Finalisation : adresse, photo et mot de passe (le reste vient de la demande acceptée)."""

    token = serializers.CharField(label='jeton', write_only=True)
    address = serializers.CharField(label='adresse', max_length=255)
    phone = serializers.CharField(
        label='téléphone', max_length=30, required=False, allow_blank=True, default='', validators=[PHONE_FORMAT]
    )
    photo = serializers.FileField(label='photo', error_messages={'required': 'Ajoutez une photo de profil.'})
    password = serializers.CharField(label='mot de passe', trim_whitespace=False, write_only=True)
    password_confirm = serializers.CharField(label='confirmation', trim_whitespace=False, write_only=True)
    accept_rules = serializers.BooleanField(label='statuts et règlement', error_messages={'required': RULES_REQUIRED})

    def validate_photo(self, value):
        try:
            return prepare_photo(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)

    def validate_accept_rules(self, value):
        if not value:
            raise serializers.ValidationError(RULES_REQUIRED)
        return value

    def validate(self, data):
        application = self.context['application']
        # Le compte n'existe pas encore : on compare le mot de passe aux données de la demande.
        candidate = User(email=application.email, first_name=application.first_name, last_name=application.last_name)
        check_new_password(data['password'], data['password_confirm'], candidate)
        return data
