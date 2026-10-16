from datetime import date

from django.contrib.auth import login
from django.db.models import Q
from django.http import FileResponse, Http404
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsBureau, IsFounder
from accounts.serializers import UserSerializer
from territories.models import Territory
from territories.scope import scope_queryset, subtree_ids

from .models import Member
from .registration import LinkProblem, check_link, complete_registration
from .serializers import (
    MemberDetailSerializer,
    MemberListSerializer,
    MemberProfileSerializer,
    RegistrationLinkSerializer,
    RegistrationSerializer,
    StatusChangeSerializer,
)
from .status import StatusChangeRefused, change_status


def link_problem_response(problem):
    return Response({'detail': problem.detail, 'code': problem.code}, status=problem.status)


class RegistrationCheckView(APIView):
    """Vérifie le lien personnel avant d'afficher le formulaire de finalisation.

    Le jeton voyage dans le corps de la requête, jamais dans l'adresse, pour ne pas
    apparaître dans les journaux des serveurs.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'registration'

    def post(self, request):
        try:
            link = check_link(str(request.data.get('token', '')))
        except LinkProblem as problem:
            return link_problem_response(problem)
        return Response(RegistrationLinkSerializer(link).data)


class RegistrationView(APIView):
    """Finalise l'inscription : crée le compte membre et ouvre sa session."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'registration'

    def post(self, request):
        token = str(request.data.get('token', ''))
        try:
            link = check_link(token)
        except LinkProblem as problem:
            return link_problem_response(problem)
        serializer = RegistrationSerializer(data=request.data, context={'application': link.application})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user = complete_registration(
                token,
                password=data['password'],
                address=data['address'],
                phone=data['phone'],
                photo=data['photo'],
                rules_accepted=data['accept_rules'],
            )
        except LinkProblem as problem:
            return link_problem_response(problem)
        login(request, user)
        return Response(
            {'user': UserSerializer(user).data, 'member_number': user.member.number},
            status=status.HTTP_201_CREATED,
        )


class MyPhotoView(APIView):
    """Photo de profil de la personne connectée (pour sa carte et son profil)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        member = getattr(request.user, 'member', None)
        if member is None or not member.photo:
            raise Http404
        response = FileResponse(member.photo.open('rb'), content_type='image/jpeg')
        response['Cache-Control'] = 'private, max-age=300'
        return response


class MyProfileView(generics.RetrieveUpdateAPIView):
    """Profil et données de carte du membre connecté (GET), modification de ses coordonnées (PATCH)."""

    permission_classes = [IsAuthenticated]
    serializer_class = MemberProfileSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):
        member = getattr(self.request.user, 'member', None)
        if member is None:
            raise Http404
        return member


class MemberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def scoped_members(user):
    """Membres que le bureau peut voir : tout pour un fondateur, son territoire et ceux qui en dépendent sinon."""
    queryset = Member.objects.select_related('user__territory__parent__parent')
    return scope_queryset(queryset, user, 'user__territory')


ORDERINGS = {
    'name': ('user__last_name', 'user__first_name'),
    'place': ('user__territory__name',),
    'date': ('joined_on', 'id'),
}


class MemberListView(generics.ListAPIView):
    """Base des membres pour le bureau exécutif, limitée au territoire de la personne connectée.

    Filtres : ``role`` (``membre`` par défaut, ou ``coordonnateur``, ``fondateur``), ``status``
    (``actif``, ``suspendu``, ``radie``), ``territory`` (identifiant ; ce territoire et ceux qui en
    dépendent, jamais au-delà du périmètre de la personne connectée), ``joined_from`` et
    ``joined_to`` (dates d'adhésion AAAA-MM-JJ, bornes comprises), ``search`` (prénom, nom, courriel ou numéro ; plusieurs
    mots doivent tous correspondre) et ``ordering`` (``name``, ``place`` ou ``date``, précédé de
    ``-`` pour l'ordre inverse ; les plus récents d'abord par défaut).
    """

    permission_classes = [IsBureau]
    serializer_class = MemberListSerializer
    pagination_class = MemberPagination

    def get_queryset(self):
        params = self.request.query_params
        queryset = scoped_members(self.request.user)

        role = params.get('role') or User.Role.MEMBRE
        if role not in User.Role.values:
            raise ValidationError({'role': ['Rôle inconnu.']})
        queryset = queryset.filter(user__role=role)

        status_filter = params.get('status')
        if status_filter:
            if status_filter not in Member.Status.values:
                raise ValidationError({'status': ['Statut inconnu.']})
            queryset = queryset.filter(status=status_filter)

        territory = params.get('territory')
        if territory:
            if not territory.isdigit() or not Territory.objects.filter(pk=territory).exists():
                raise ValidationError({'territory': ['Localité inconnue.']})
            queryset = queryset.filter(user__territory__in=subtree_ids(Territory.objects.get(pk=territory)))

        bounds = {}
        for name, lookup in (('joined_from', 'joined_on__gte'), ('joined_to', 'joined_on__lte')):
            value = params.get(name)
            if value:
                try:
                    bounds[name] = date.fromisoformat(value)
                except ValueError:
                    raise ValidationError({name: ['Saisissez une date valide au format AAAA-MM-JJ.']})
                queryset = queryset.filter(**{lookup: bounds[name]})
        if len(bounds) == 2 and bounds['joined_from'] > bounds['joined_to']:
            raise ValidationError({'joined_to': ['La date de fin doit suivre la date de début.']})

        for term in params.get('search', '').split():
            queryset = queryset.filter(
                Q(user__first_name__icontains=term)
                | Q(user__last_name__icontains=term)
                | Q(user__email__icontains=term)
                | Q(number__icontains=term)
            )

        ordering = params.get('ordering') or '-date'
        key = ordering.lstrip('-')
        if key not in ORDERINGS:
            raise ValidationError({'ordering': ['Tri inconnu.']})
        fields = ORDERINGS[key]
        return queryset.order_by(*(f'-{f}' if ordering.startswith('-') else f for f in fields))


class MemberDetailView(generics.RetrieveAPIView):
    """Fiche d'un membre. Hors du territoire de la personne connectée : 404."""

    permission_classes = [IsBureau]
    serializer_class = MemberDetailSerializer

    def get_queryset(self):
        return scoped_members(self.request.user)


class MemberPhotoView(APIView):
    """Photo d'un membre du périmètre, pour sa fiche."""

    permission_classes = [IsBureau]

    def get(self, request, pk):
        member = generics.get_object_or_404(scoped_members(request.user), pk=pk)
        if not member.photo:
            raise Http404
        response = FileResponse(member.photo.open('rb'), content_type='image/jpeg')
        response['Cache-Control'] = 'private, max-age=300'
        return response


class MemberStatusView(APIView):
    """Un fondateur rend actif, suspend ou radie un membre ; le compte suit, l'historique est conservé."""

    permission_classes = [IsFounder]

    def post(self, request, pk):
        member = generics.get_object_or_404(scoped_members(request.user), pk=pk)
        serializer = StatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            member = change_status(
                member,
                serializer.validated_data['status'],
                by=request.user,
                reason=serializer.validated_data['reason'],
            )
        except StatusChangeRefused as refusal:
            return Response({'detail': refusal.detail, 'code': refusal.code}, status=status.HTTP_409_CONFLICT)
        member = scoped_members(request.user).get(pk=member.pk)
        return Response(MemberDetailSerializer(member, context={'request': request}).data)
