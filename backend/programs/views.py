from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from django.http import Http404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsBureau
from audit.exports import export_list
from members.models import Member
from territories.models import Territory
from territories.scope import can_access

from .filters import describe_filters, filter_programs
from .models import Activity, Attendance, Program, Registration
from .rules import (
    attendance_candidates,
    bureau_activities,
    bureau_programs,
    eligible_managers,
    member_activities,
    member_programs,
)
from .serializers import (
    ActivitySerializer,
    ActivityWriteSerializer,
    AttendanceSerializer,
    MemberActivitySerializer,
    MemberProgramSerializer,
    ProgramDetailSerializer,
    ProgramSerializer,
    ProgramWriteSerializer,
    ReportSerializer,
    person,
    person_name,
    registration_is_open,
)


class ProgramPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def counted(queryset):
    """Activités avec leur nombre d'inscrits et de présents."""
    return queryset.annotate(
        registrations_count=Count('registrations', distinct=True), attendance_count=Count('attendances', distinct=True)
    )


def with_activities(queryset):
    """Programmes avec le nombre de leurs activités et ces activités par ordre de date (compteurs compris)."""
    activities = counted(Activity.objects.select_related('report_author').order_by('starts_at', 'id'))
    return queryset.annotate(activities_count=Count('activities', distinct=True)).prefetch_related(
        Prefetch('activities', queryset=activities)
    )


# --- Bureau : programmes ---------------------------------------------------------------------------------


class ProgramListCreateView(generics.ListCreateAPIView):
    """Liste des programmes du périmètre (GET) et création d'un programme (POST), pour le bureau.

    Filtres : voir ``programs.filters``. Un coordonnateur ne crée un programme que dans son périmètre.
    """

    permission_classes = [IsBureau]
    pagination_class = ProgramPagination

    def get_serializer_class(self):
        return ProgramWriteSerializer if self.request.method == 'POST' else ProgramSerializer

    def get_queryset(self):
        return filter_programs(bureau_programs(self.request.user), self.request.query_params)

    def create(self, request, *args, **kwargs):
        serializer = ProgramWriteSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        program = serializer.save(created_by=request.user)
        fresh = with_activities(bureau_programs(request.user)).get(pk=program.pk)
        return Response(ProgramDetailSerializer(fresh).data, status=status.HTTP_201_CREATED)


class ProgramDetailView(generics.RetrieveUpdateAPIView):
    """Fiche d'un programme avec ses activités (GET) et modification (PATCH). Hors périmètre : 404."""

    permission_classes = [IsBureau]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_serializer_class(self):
        return ProgramWriteSerializer if self.request.method == 'PATCH' else ProgramDetailSerializer

    def get_queryset(self):
        return with_activities(bureau_programs(self.request.user))

    def retrieve(self, request, *args, **kwargs):
        return Response(ProgramDetailSerializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        program = self.get_object()
        serializer = ProgramWriteSerializer(program, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ProgramDetailSerializer(self.get_queryset().get(pk=program.pk)).data)


class ProgramManagersView(APIView):
    """Responsables possibles d'un programme d'une localité : fondateurs et coordonnateurs qui la gèrent."""

    permission_classes = [IsBureau]

    def get(self, request):
        try:
            territory = Territory.objects.get(pk=int(request.query_params.get('territory', '')))
        except (ValueError, Territory.DoesNotExist):
            return Response({'territory': ['Localité inconnue.']}, status=status.HTTP_400_BAD_REQUEST)
        if not can_access(request.user, territory):
            raise Http404
        return Response(
            [
                {'id': user.pk, 'name': person_name(user), 'role_label': user.get_role_display()}
                for user in eligible_managers(territory)
            ]
        )


class ProgramExportView(APIView):
    """Export Excel de la liste des programmes affichée (mêmes filtres), noté dans le journal."""

    permission_classes = [IsBureau]

    def get(self, request):
        params = request.query_params
        programs = filter_programs(bureau_programs(request.user), params)
        rows = (
            (
                program.name,
                program.objective,
                program.territory.name,
                person_name(program.manager) if program.manager else None,
                program.start_date,
                program.end_date,
                program.get_status_display(),
                program.activities_count,
            )
            for program in programs
        )
        return export_list(
            request,
            base_name='programmes',
            subject='Programmes',
            headers=['Programme', 'Objectif', 'Localité', 'Responsable', 'Début', 'Fin', 'État', "Nombre d'activités"],
            rows=rows,
            filters=describe_filters(params),
        )


# --- Bureau : activités ----------------------------------------------------------------------------------


class ActivityCreateView(APIView):
    """Ajoute une activité à un programme du périmètre."""

    permission_classes = [IsBureau]

    def post(self, request, pk):
        program = generics.get_object_or_404(bureau_programs(request.user), pk=pk)
        serializer = ActivityWriteSerializer(data=request.data, context={'program': program})
        serializer.is_valid(raise_exception=True)
        activity = serializer.save(program=program, created_by=request.user)
        return Response(ActivitySerializer(self.reload(request.user, activity)).data, status=status.HTTP_201_CREATED)

    @staticmethod
    def reload(user, activity):
        return generics.get_object_or_404(counted(bureau_activities(user)), pk=activity.pk)


class ActivityDetailView(generics.RetrieveUpdateAPIView):
    """Fiche d'une activité avec son compte rendu (GET) et modification (PATCH). Hors périmètre : 404."""

    permission_classes = [IsBureau]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        return counted(bureau_activities(self.request.user))

    def get_serializer_class(self):
        return ActivityWriteSerializer if self.request.method == 'PATCH' else ActivitySerializer

    def retrieve(self, request, *args, **kwargs):
        return Response(ActivitySerializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        activity = self.get_object()
        serializer = ActivityWriteSerializer(
            activity, data=request.data, partial=True, context={'program': activity.program}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ActivitySerializer(self.get_queryset().get(pk=activity.pk)).data)


NOT_STARTED = {
    'detail': "Cette activité n'a pas encore eu lieu : le compte rendu et les présences se renseignent après.",
    'code': 'not_started',
}


class ActivityReportView(APIView):
    """Compte rendu d'une activité, et mise à jour de l'état du programme (PUT). Hors périmètre : 404."""

    permission_classes = [IsBureau]

    def put(self, request, pk):
        activity = generics.get_object_or_404(bureau_activities(request.user), pk=pk)
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not activity.has_started:
            return Response(NOT_STARTED, status=status.HTTP_409_CONFLICT)
        with transaction.atomic():
            activity.report = serializer.validated_data['report'].strip()
            activity.report_author = request.user
            activity.reported_at = timezone.now()
            activity.save(update_fields=['report', 'report_author', 'reported_at', 'updated_at'])
            new_status = serializer.validated_data.get('program_status')
            if new_status and new_status != activity.program.status:
                activity.program.status = new_status
                activity.program.save(update_fields=['status', 'updated_at'])
        return Response(ActivitySerializer(counted(bureau_activities(request.user)).get(pk=activity.pk)).data)


def attendance_payload(activity):
    """Liste à cocher : inscrits et membres du territoire, avec leur présence."""
    present = set(activity.attendances.values_list('member_id', flat=True))
    registered = set(activity.registrations.values_list('member_id', flat=True))
    members = [
        {
            'id': member.pk,
            'number': member.number,
            'first_name': member.user.first_name,
            'last_name': member.user.last_name,
            'territory': member.user.territory.name if member.user.territory else None,
            'registered': member.pk in registered,
            'present': member.pk in present,
        }
        for member in attendance_candidates(activity)
    ]
    return {
        'noted': activity.attendance_noted_at is not None,
        'noted_at': activity.attendance_noted_at,
        'noted_by': person(activity.attendance_noted_by),
        'present_count': len(present),
        'members': members,
    }


class ActivityAttendanceView(APIView):
    """Présences à une activité : la liste à cocher (GET) et son enregistrement complet (PUT)."""

    permission_classes = [IsBureau]

    def get(self, request, pk):
        activity = generics.get_object_or_404(bureau_activities(request.user), pk=pk)
        return Response(attendance_payload(activity))

    def put(self, request, pk):
        activity = generics.get_object_or_404(bureau_activities(request.user), pk=pk)
        serializer = AttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not activity.has_started:
            return Response(NOT_STARTED, status=status.HTTP_409_CONFLICT)
        ids = set(serializer.validated_data['members'])
        allowed = set(attendance_candidates(activity).values_list('pk', flat=True))
        if not ids <= allowed:
            return Response(
                {'members': ["Certains membres ne font pas partie de la localité du programme ni des inscrits : ils ne peuvent pas être cochés."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            Attendance.objects.filter(activity=activity).exclude(member_id__in=ids).delete()
            existing = set(Attendance.objects.filter(activity=activity).values_list('member_id', flat=True))
            Attendance.objects.bulk_create(
                [Attendance(activity=activity, member_id=member_id, recorded_by=request.user) for member_id in ids - existing]
            )
            activity.attendance_noted_at = timezone.now()
            activity.attendance_noted_by = request.user
            activity.save(update_fields=['attendance_noted_at', 'attendance_noted_by', 'updated_at'])
        activity.refresh_from_db()
        return Response(attendance_payload(activity))


def registrations_of(activity):
    return activity.registrations.select_related('member__user__territory').order_by(
        'member__user__last_name', 'member__user__first_name', 'id'
    )


class ActivityRegistrationsView(APIView):
    """Inscrits à une activité, pour le bureau du territoire."""

    permission_classes = [IsBureau]

    def get(self, request, pk):
        activity = generics.get_object_or_404(bureau_activities(request.user), pk=pk)
        results = [
            {
                'member': registration.member_id,
                'number': registration.member.number,
                'first_name': registration.member.user.first_name,
                'last_name': registration.member.user.last_name,
                'email': registration.member.user.email,
                'territory': registration.member.user.territory.name if registration.member.user.territory else None,
                'registered_at': registration.created_at,
            }
            for registration in registrations_of(activity)
        ]
        return Response({'count': len(results), 'results': results})


class ActivityRegistrationsExportView(APIView):
    """Export Excel des inscrits à une activité, noté dans le journal."""

    permission_classes = [IsBureau]

    def get(self, request, pk):
        activity = generics.get_object_or_404(bureau_activities(request.user), pk=pk)
        rows = (
            (
                registration.member.number,
                registration.member.user.last_name,
                registration.member.user.first_name,
                registration.member.user.email,
                registration.member.user.territory.name if registration.member.user.territory else None,
                registration.created_at,
            )
            for registration in registrations_of(activity)
        )
        return export_list(
            request,
            base_name='inscrits',
            subject=f'Inscrits · {activity.title}'[:255],
            headers=["N° d'adhérent", 'Nom', 'Prénom', 'Courriel', 'Localité', 'Inscrit le'],
            rows=rows,
            filters={'Programme': activity.program.name, 'Activité': activity.title},
        )


# --- Membre : programmes du territoire et inscription ----------------------------------------------------


def with_registration(queryset, member):
    """Ajoute à chaque activité son nombre d'inscrits et l'inscription du membre connecté."""
    mine = Registration.objects.filter(activity=OuterRef('pk'), member=member) if member else None
    queryset = queryset.annotate(registrations_count=Count('registrations', distinct=True))
    if mine is not None:
        return queryset.annotate(registered=Exists(mine))
    return queryset


class MemberProgramListView(generics.ListAPIView):
    """Programmes du territoire du membre, avec leurs activités par ordre de date.

    Sans filtre : les programmes prévus et en cours. ``status`` (``prevu``, ``en_cours``, ``termine``) en choisit un
    autre ; ``search`` cherche dans le nom et l'objectif. Les programmes annulés et ceux des autres territoires
    ne sont jamais montrés.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = MemberProgramSerializer
    pagination_class = ProgramPagination

    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params
        queryset = member_programs(user)
        status_filter = params.get('status')
        if status_filter:
            if status_filter not in (*Program.OPEN, Program.Status.DONE):
                raise ValidationError({'status': ['État inconnu.']})
            queryset = queryset.filter(status=status_filter)
        else:
            queryset = queryset.filter(status__in=Program.OPEN)
        for term in params.get('search', '').split():
            queryset = queryset.filter(Q(name__icontains=term) | Q(objective__icontains=term))
        member = getattr(user, 'member', None)
        activities = with_registration(Activity.objects.order_by('starts_at', 'id'), member)
        return queryset.prefetch_related(Prefetch('activities', queryset=activities)).order_by('start_date', 'id')


class MemberActivityView(generics.RetrieveAPIView):
    """Une activité d'un programme du territoire du membre, avec son inscription. Autre territoire : 404."""

    permission_classes = [IsAuthenticated]
    serializer_class = MemberActivitySerializer

    def get_queryset(self):
        return with_registration(member_activities(self.request.user), getattr(self.request.user, 'member', None))


class MemberRegistrationView(APIView):
    """Inscription (POST) et désinscription (DELETE) du membre connecté à une activité de son territoire."""

    permission_classes = [IsAuthenticated]

    def activity_and_member(self, request, pk):
        activity = generics.get_object_or_404(member_activities(request.user), pk=pk)
        member = getattr(request.user, 'member', None)
        if member is None:
            return activity, None
        return activity, member

    def current(self, request, pk):
        queryset = with_registration(member_activities(request.user), request.user.member)
        return MemberActivitySerializer(queryset.get(pk=pk), context={'request': request}).data

    def post(self, request, pk):
        activity, member = self.activity_and_member(request, pk)
        if member is None:
            return Response(
                {'detail': "Seuls les membres ayant un dossier peuvent s'inscrire à une activité.", 'code': 'no_member_file'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if member.status != Member.Status.ACTIF:
            return Response(
                {'detail': "Votre compte n'est pas actif : vous ne pouvez pas vous inscrire.", 'code': 'inactive_member'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not registration_is_open(activity):
            reason = (
                "Ce programme n'est plus ouvert aux inscriptions."
                if activity.program.status not in Program.OPEN
                else "L'activité a déjà commencé : les inscriptions sont closes."
            )
            return Response({'detail': reason, 'code': 'registration_closed'}, status=status.HTTP_409_CONFLICT)
        _, created = Registration.objects.get_or_create(activity=activity, member=member)
        return Response(self.current(request, pk), status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, pk):
        activity, member = self.activity_and_member(request, pk)
        if member is None:
            raise Http404
        registration = Registration.objects.filter(activity=activity, member=member).first()
        if registration is not None:
            if activity.has_started:
                return Response(
                    {'detail': "L'activité a déjà commencé : vous ne pouvez plus vous désinscrire.", 'code': 'registration_closed'},
                    status=status.HTTP_409_CONFLICT,
                )
            registration.delete()
        return Response(self.current(request, pk))
