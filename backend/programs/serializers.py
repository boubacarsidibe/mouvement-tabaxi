from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from territories.models import Territory
from territories.scope import can_access
from territories.serializers import TerritorySummarySerializer

from .models import Activity, Program
from .rules import eligible_managers

BAD_PERIOD = 'La date de fin doit être égale ou postérieure à la date de début.'


def person_name(user):
    return user.get_full_name().strip() or user.email


def person(user):
    return {'id': user.pk, 'name': person_name(user)} if user else None


def local_date(moment):
    return timezone.localtime(moment).date()


class ActivitySerializer(serializers.ModelSerializer):
    """Activité telle que le bureau la voit : avec son compte rendu, ses inscrits et ses présences."""

    program = serializers.SerializerMethodField()
    report_author = serializers.SerializerMethodField()
    has_started = serializers.BooleanField(read_only=True)
    is_over = serializers.BooleanField(read_only=True)
    registrations_count = serializers.IntegerField(read_only=True, default=0)
    attendance_count = serializers.SerializerMethodField()
    attendance_noted = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = (
            'id', 'program', 'title', 'starts_at', 'ends_at', 'place', 'description', 'report', 'report_author',
            'reported_at', 'has_started', 'is_over', 'registrations_count', 'attendance_noted', 'attendance_count',
        )
        read_only_fields = fields

    def get_program(self, activity):
        program = activity.program
        return {
            'id': program.pk,
            'name': program.name,
            'status': program.status,
            'status_label': program.get_status_display(),
            'territory': program.territory.name,
        }

    def get_report_author(self, activity):
        return person(activity.report_author)

    def get_attendance_noted(self, activity):
        return activity.attendance_noted_at is not None

    def get_attendance_count(self, activity):
        """Nombre de présents ; ``None`` tant que la liste des présences n'est pas notée."""
        if activity.attendance_noted_at is None:
            return None
        count = getattr(activity, 'attendance_count', None)
        return count if count is not None else activity.attendances.count()


class ProgramSerializer(serializers.ModelSerializer):
    """Programme dans une liste."""

    territory = TerritorySummarySerializer(read_only=True)
    manager = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    activities_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Program
        fields = (
            'id', 'name', 'objective', 'territory', 'manager', 'start_date', 'end_date', 'status', 'status_label',
            'activities_count',
        )
        read_only_fields = fields

    def get_manager(self, program):
        return person(program.manager)


class ProgramDetailSerializer(ProgramSerializer):
    """Programme avec ses activités, par ordre de date."""

    activities = ActivitySerializer(many=True, read_only=True)

    class Meta(ProgramSerializer.Meta):
        fields = ProgramSerializer.Meta.fields + ('activities',)
        read_only_fields = fields


class ProgramWriteSerializer(serializers.ModelSerializer):
    """Création et modification d'un programme par le bureau."""

    territory = serializers.PrimaryKeyRelatedField(
        queryset=Territory.objects.all(),
        error_messages={
            'required': 'Choisissez la localité concernée.',
            'does_not_exist': 'Localité inconnue.',
            'incorrect_type': 'Localité inconnue.',
            'null': 'Choisissez la localité concernée.',
        },
    )
    manager = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
        error_messages={'does_not_exist': 'Responsable inconnu.', 'incorrect_type': 'Responsable inconnu.'},
    )

    class Meta:
        model = Program
        fields = ('name', 'objective', 'territory', 'manager', 'start_date', 'end_date', 'status')
        extra_kwargs = {
            'name': {'error_messages': {'required': 'Donnez un nom au programme.', 'blank': 'Donnez un nom au programme.'}},
            'objective': {
                'error_messages': {'required': "Précisez l'objectif du programme.", 'blank': "Précisez l'objectif du programme."}
            },
            'start_date': {'error_messages': {'required': 'Indiquez la date de début.', 'invalid': 'Date invalide : utilisez le format AAAA-MM-JJ.'}},
            'end_date': {'error_messages': {'required': 'Indiquez la date de fin.', 'invalid': 'Date invalide : utilisez le format AAAA-MM-JJ.'}},
        }

    def validate_territory(self, territory):
        user = self.context['request'].user
        if not can_access(user, territory):
            raise serializers.ValidationError("Cette localité est hors de votre périmètre : vous ne pouvez pas y gérer de programme.")
        unchanged = self.instance is not None and self.instance.territory_id == territory.pk
        if not territory.is_active and not unchanged:
            raise serializers.ValidationError("Cette localité n'est plus active.")
        return territory

    def validate(self, data):
        instance = self.instance
        territory = data.get('territory', instance.territory if instance else None)
        start = data.get('start_date', instance.start_date if instance else None)
        end = data.get('end_date', instance.end_date if instance else None)
        manager = data.get('manager', instance.manager if instance else None)
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': [BAD_PERIOD]})
        if manager is not None and territory is not None and not eligible_managers(territory).filter(pk=manager.pk).exists():
            raise serializers.ValidationError(
                {'manager': ["Ce responsable ne coordonne pas cette localité : choisissez un coordonnateur de la localité, d'une localité dont elle dépend, ou un fondateur."]}
            )
        if instance is not None and (start or end):
            outside = [
                activity
                for activity in instance.activities.all()
                if not (start <= local_date(activity.starts_at) <= end)
                or (activity.ends_at and not (start <= local_date(activity.ends_at) <= end))
            ]
            if outside:
                raise serializers.ValidationError(
                    {
                        'start_date': [
                            f"{len(outside)} activité(s) se déroulent en dehors de ces dates : changez-les d'abord ou gardez une période qui les contient."
                        ]
                    }
                )
        return data


class ActivityWriteSerializer(serializers.ModelSerializer):
    """Création et modification d'une activité ; le programme est donné par la route."""

    class Meta:
        model = Activity
        fields = ('title', 'starts_at', 'ends_at', 'place', 'description')
        extra_kwargs = {
            'title': {'error_messages': {'required': "Donnez un titre à l'activité.", 'blank': "Donnez un titre à l'activité."}},
            'place': {'error_messages': {'required': "Indiquez le lieu de l'activité.", 'blank': "Indiquez le lieu de l'activité."}},
            'description': {
                'error_messages': {'required': "Décrivez l'activité.", 'blank': "Décrivez l'activité."}
            },
            'starts_at': {
                'error_messages': {'required': "Indiquez la date et l'heure de l'activité.", 'invalid': 'Date et heure invalides.'}
            },
            'ends_at': {'error_messages': {'invalid': 'Date et heure invalides.'}},
        }

    def validate(self, data):
        program = self.context['program']
        instance = self.instance
        starts = data.get('starts_at', instance.starts_at if instance else None)
        ends = data.get('ends_at', instance.ends_at if instance else None)
        if program.status == Program.Status.CANCELLED:
            raise serializers.ValidationError({'detail': "Ce programme est annulé : on n'y planifie plus d'activité."})
        if starts and ends and ends < starts:
            raise serializers.ValidationError({'ends_at': ["L'heure de fin doit suivre l'heure de début."]})
        if starts and not (program.start_date <= local_date(starts) <= program.end_date):
            raise serializers.ValidationError(
                {
                    'starts_at': [
                        f"La date de l'activité doit se situer entre le {program.start_date:%d/%m/%Y} "
                        f"et le {program.end_date:%d/%m/%Y}, dates du programme."
                    ]
                }
            )
        if ends and local_date(ends) > program.end_date:
            raise serializers.ValidationError(
                {'ends_at': [f"L'activité doit finir au plus tard le {program.end_date:%d/%m/%Y}, fin du programme."]}
            )
        return data


class ReportSerializer(serializers.Serializer):
    """Compte rendu d'une activité, avec la mise à jour facultative de l'état du programme."""

    report = serializers.CharField(
        max_length=5000,
        error_messages={
            'required': "Écrivez le compte rendu de l'activité.",
            'blank': "Écrivez le compte rendu de l'activité.",
            'max_length': 'Le compte rendu ne peut pas dépasser 5 000 caractères.',
        },
    )
    program_status = serializers.ChoiceField(
        choices=Program.Status.choices,
        required=False,
        error_messages={'invalid_choice': 'État inconnu. Choisissez Prévu, En cours, Terminé ou Annulé.'},
    )


class AttendanceSerializer(serializers.Serializer):
    """Liste des membres présents à une activité (leurs identifiants de dossier)."""

    members = serializers.ListField(
        child=serializers.IntegerField(min_value=1, error_messages={'invalid': 'Identifiant de membre invalide.'}),
        allow_empty=True,
        error_messages={'required': 'Envoyez la liste des membres présents.', 'not_a_list': 'Envoyez la liste des membres présents.'},
    )


class MemberActivitySerializer(serializers.ModelSerializer):
    """Activité telle que le membre la voit : sans compte rendu, avec son inscription."""

    program = serializers.SerializerMethodField()
    registered = serializers.BooleanField(read_only=True, default=False)
    registrations_count = serializers.IntegerField(read_only=True, default=0)
    registration_open = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = (
            'id', 'program', 'title', 'starts_at', 'ends_at', 'place', 'description', 'registered',
            'registrations_count', 'registration_open',
        )
        read_only_fields = fields

    def get_program(self, activity):
        program = activity.program
        return {
            'id': program.pk,
            'name': program.name,
            'status': program.status,
            'status_label': program.get_status_display(),
            'territory': program.territory.name,
            'manager': person(program.manager),
        }

    def get_registration_open(self, activity):
        return registration_is_open(activity)


def registration_is_open(activity):
    """Inscriptions ouvertes : programme prévu ou en cours, et activité pas encore commencée."""
    return activity.program.status in Program.OPEN and not activity.has_started


class MemberProgramSerializer(serializers.ModelSerializer):
    """Programme du territoire du membre, avec ses activités par ordre de date."""

    territory = TerritorySummarySerializer(read_only=True)
    manager = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    activities = serializers.SerializerMethodField()

    class Meta:
        model = Program
        fields = (
            'id', 'name', 'objective', 'territory', 'manager', 'start_date', 'end_date', 'status', 'status_label',
            'activities',
        )
        read_only_fields = fields

    def get_manager(self, program):
        return person(program.manager)

    def get_activities(self, program):
        # ``activities`` est préchargé avec les compteurs et l'inscription de la personne connectée.
        return MemberActivitySerializer(program.activities.all(), many=True, context=self.context).data
