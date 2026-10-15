from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from territories.models import Territory

from .models import Application

ALREADY_IN_PROGRESS = 'Une demande est déjà en cours pour ce courriel.'
ALREADY_MEMBER = 'Ce courriel est déjà associé à un compte. Connectez-vous ou utilisez « Mot de passe oublié ».'
CHOOSE_TERRITORY = 'Choisissez une localité dans la liste.'
CONSENT_REQUIRED = 'Vous devez accepter le traitement de vos données pour envoyer la demande.'


class ApplicationSubmitSerializer(serializers.ModelSerializer):
    """Dépôt public d'une demande d'adhésion. Tous les champs sont obligatoires."""

    territory = serializers.PrimaryKeyRelatedField(
        label='localité souhaitée',
        queryset=Territory.objects.filter(is_active=True).select_related('parent__parent'),
        error_messages={
            'required': CHOOSE_TERRITORY,
            'null': CHOOSE_TERRITORY,
            'does_not_exist': CHOOSE_TERRITORY,
            'incorrect_type': CHOOSE_TERRITORY,
        },
    )
    consent = serializers.BooleanField(
        label='consentement', write_only=True, error_messages={'required': CONSENT_REQUIRED}
    )
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Application
        fields = (
            'reference', 'first_name', 'last_name', 'email', 'territory', 'profession', 'motivation',
            'consent', 'status', 'status_label', 'created_at',
        )
        read_only_fields = ('reference', 'status', 'created_at')

    def validate_email(self, value):
        value = value.strip()
        if Application.objects.filter(email__iexact=value, status__in=Application.IN_PROGRESS).exists():
            raise serializers.ValidationError(ALREADY_IN_PROGRESS)
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(ALREADY_MEMBER)
        return value

    def validate_territory(self, territory):
        # Une commune d'une région désactivée n'est plus proposée.
        parent = territory.parent
        while parent is not None:
            if not parent.is_active:
                raise serializers.ValidationError(CHOOSE_TERRITORY)
            parent = parent.parent
        return territory

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError(CONSENT_REQUIRED)
        return value

    def create(self, validated_data):
        validated_data.pop('consent')
        return Application.objects.create(consent_at=timezone.now(), **validated_data)

    def to_representation(self, instance):
        # La réponse confirme la demande sans renvoyer les informations personnelles.
        data = super().to_representation(instance)
        return {key: data[key] for key in ('reference', 'status', 'status_label', 'created_at')}
