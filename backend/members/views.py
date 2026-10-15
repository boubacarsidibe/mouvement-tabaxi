from django.contrib.auth import login
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.serializers import UserSerializer

from .registration import LinkProblem, check_link, complete_registration
from .serializers import RegistrationLinkSerializer, RegistrationSerializer


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
