from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import RegexValidator
from rest_framework import serializers

from accounts.models import User
from accounts.serializers import check_new_password
from territories.models import Territory
from territories.scope import ancestor_ids
from territories.serializers import TerritorySummarySerializer

from .models import Member, MemberStatusChange
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


LOCKED_FIELDS = ('email', 'territory', 'number', 'joined_on')
# Le nom se renseigne une fois, s'il manque (compte créé sans nom) ; ensuite seul le bureau le change.
NAME_FIELDS = ('first_name', 'last_name')


class MemberProfileSerializer(serializers.ModelSerializer):
    """Profil et carte du membre connecté.

    Le membre modifie son adresse, son téléphone et sa photo. Son nom, son courriel et son
    territoire ne changent que par le bureau ; seul un nom encore vide peut être renseigné.
    """

    first_name = serializers.CharField(source='user.first_name', required=False, max_length=150)
    last_name = serializers.CharField(source='user.last_name', required=False, max_length=150)
    email = serializers.EmailField(source='user.email', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)
    role_label = serializers.CharField(source='user.get_role_display', read_only=True)
    territory = TerritorySummarySerializer(source='user.territory', read_only=True)
    locality = serializers.SerializerMethodField()
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True, validators=[PHONE_FORMAT])
    photo = serializers.FileField(write_only=True, required=False)
    photo_url = serializers.SerializerMethodField()
    coordinator = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = (
            'number', 'joined_on', 'first_name', 'last_name', 'email', 'role', 'role_label', 'territory',
            'locality', 'address', 'phone', 'photo', 'photo_url', 'coordinator',
        )
        read_only_fields = ('number', 'joined_on')
        extra_kwargs = {'address': {'max_length': 255}}

    def get_locality(self, member):
        """Localité affichée sur la carte : celle du membre, sinon le pays (compte de niveau national)."""
        if member.user.territory is not None:
            return member.user.territory.name
        country = Territory.objects.filter(kind=Territory.Kind.PAYS).order_by('id').first()
        return country.name if country else ''

    def get_photo_url(self, member):
        return '/api/members/me/photo/' if member.photo else None

    def get_coordinator(self, member):
        """Coordonnateur le plus proche du membre : celui de son territoire, sinon de celui dont il dépend."""
        user = member.user
        if user.territory is None:
            return None
        for territory_id in ancestor_ids(user.territory):
            coordinator = (
                User.objects.filter(role=User.Role.COORDONNATEUR, territory_id=territory_id, is_active=True)
                .exclude(pk=user.pk)
                .select_related('territory')
                .order_by('date_joined', 'id')
                .first()
            )
            if coordinator:
                return {
                    'first_name': coordinator.first_name,
                    'last_name': coordinator.last_name,
                    'email': coordinator.email,
                    'territory': coordinator.territory.name,
                }
        return None

    def validate(self, data):
        locked = [name for name in LOCKED_FIELDS if name in self.initial_data]
        user = self.instance.user if self.instance else None
        locked += [name for name in NAME_FIELDS if name in self.initial_data and user and getattr(user, name)]
        if locked:
            raise serializers.ValidationError(
                {name: ['Seul le bureau peut modifier cette information.'] for name in locked}
            )
        return data

    def validate_photo(self, value):
        try:
            return prepare_photo(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)

    def validate_first_name(self, value):
        return self._required_name(value)

    def validate_last_name(self, value):
        return self._required_name(value)

    def _required_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Ce champ est obligatoire.')
        return value

    def update(self, member, validated_data):
        names = validated_data.pop('user', {})
        if names:
            for field, value in names.items():
                setattr(member.user, field, value)
            member.user.save(update_fields=list(names))
        old_photo = member.photo.name if 'photo' in validated_data and member.photo else None
        member = super().update(member, validated_data)
        if old_photo and old_photo != member.photo.name:
            member.photo.storage.delete(old_photo)
        return member


class MemberListSerializer(serializers.ModelSerializer):
    """Une ligne de la base des membres, telle que le bureau la consulte."""

    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)
    role_label = serializers.CharField(source='user.get_role_display', read_only=True)
    territory = TerritorySummarySerializer(source='user.territory', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Member
        fields = (
            'id', 'number', 'first_name', 'last_name', 'email', 'role', 'role_label', 'territory',
            'joined_on', 'status', 'status_label',
        )
        read_only_fields = fields


class MemberStatusChangeSerializer(serializers.ModelSerializer):
    from_status_label = serializers.CharField(source='get_from_status_display', read_only=True)
    to_status_label = serializers.CharField(source='get_to_status_display', read_only=True)
    changed_by = serializers.SerializerMethodField()

    class Meta:
        model = MemberStatusChange
        fields = (
            'id', 'from_status', 'from_status_label', 'to_status', 'to_status_label', 'reason',
            'changed_by', 'changed_at',
        )
        read_only_fields = fields

    def get_changed_by(self, change):
        user = change.changed_by
        return {'id': user.pk, 'first_name': user.first_name, 'last_name': user.last_name} if user else None


class MemberDetailSerializer(MemberListSerializer):
    """Fiche d'un membre : coordonnées et, pour les fondateurs seulement, l'historique des statuts."""

    phone = serializers.CharField(read_only=True)
    address = serializers.CharField(read_only=True)
    photo_url = serializers.SerializerMethodField()
    status_history = serializers.SerializerMethodField()

    class Meta(MemberListSerializer.Meta):
        fields = MemberListSerializer.Meta.fields + ('phone', 'address', 'photo_url', 'status_history')
        read_only_fields = fields

    def get_photo_url(self, member):
        return f'/api/members/{member.pk}/photo/' if member.photo else None

    def get_status_history(self, member):
        request = self.context.get('request')
        if request is None or not request.user.is_founder:
            return None
        changes = member.status_changes.select_related('changed_by')
        return MemberStatusChangeSerializer(changes, many=True).data


class StatusChangeSerializer(serializers.Serializer):
    """Nouveau statut d'un membre ; le motif est obligatoire pour suspendre ou radier."""

    REASON_REQUIRED = {
        Member.Status.SUSPENDU: 'Indiquez le motif de la suspension.',
        Member.Status.RADIE: 'Indiquez le motif de la radiation.',
    }

    status = serializers.ChoiceField(
        label='statut',
        choices=Member.Status.choices,
        error_messages={
            'required': 'Choisissez le nouveau statut.',
            'invalid_choice': 'Statut inconnu. Choisissez Actif, Suspendu ou Radié.',
        },
    )
    reason = serializers.CharField(label='motif', required=False, allow_blank=True, default='', max_length=1000)

    def validate(self, data):
        required = self.REASON_REQUIRED.get(data['status'])
        if required and not data['reason']:
            raise serializers.ValidationError({'reason': [required]})
        return data
