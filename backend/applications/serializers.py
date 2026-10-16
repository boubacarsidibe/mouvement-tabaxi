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


class TerritorySummarySerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    path = serializers.SerializerMethodField(help_text='Exemple : « Sénégal › Saint-Louis › Podor ».')

    class Meta:
        model = Territory
        fields = ('id', 'name', 'kind', 'kind_label', 'path')

    def get_path(self, territory):
        names = []
        while territory is not None:
            names.append(territory.name)
            territory = territory.parent
        return ' › '.join(reversed(names))


class DeciderSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'first_name', 'last_name', 'email')


class ApplicationSerializer(serializers.ModelSerializer):
    """Demande complète, telle que les fondateurs l'examinent."""

    territory = TerritorySummarySerializer(read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    decided_by = DeciderSerializer(read_only=True)

    class Meta:
        model = Application
        fields = (
            'id', 'reference', 'first_name', 'last_name', 'email', 'territory', 'profession', 'motivation',
            'status', 'status_label', 'created_at', 'consent_at',
            'decided_by', 'decided_at', 'rejection_reason', 'internal_note',
        )
        read_only_fields = fields


class AcceptSerializer(serializers.Serializer):
    internal_note = serializers.CharField(label='note interne', max_length=2000, required=False, allow_blank=True, default='')


REJECTION_REASON_REQUIRED = 'Le motif du refus est obligatoire.'


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField(
        label='motif du refus',
        max_length=2000,
        error_messages={'required': REJECTION_REASON_REQUIRED, 'blank': REJECTION_REASON_REQUIRED, 'null': REJECTION_REASON_REQUIRED},
    )
    internal_note = serializers.CharField(label='note interne', max_length=2000, required=False, allow_blank=True, default='')
