from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from core.mail import EmailNotSent

from . import invitations, lockout, password_reset
from .models import User
from .permissions import IsFounder
from .serializers import (
    ForgotPasswordSerializer,
    InvitationDetailSerializer,
    InvitationSerializer,
    LoginSerializer,
    PasswordResetSerializer,
    TokenSerializer,
    UserSerializer,
)

INVALID_CREDENTIALS = 'Courriel ou mot de passe incorrect.'
INACTIVE_ACCOUNT = (
    'Ce compte est suspendu ou radié : la connexion est impossible. Contactez le bureau du mouvement.'
)


class LoginView(APIView):
    """Connexion unique pour tous les rôles, par courriel et mot de passe."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        ip = lockout.client_ip(request)

        # Le blocage est vérifié avant le mot de passe : pendant un blocage, même le bon
        # mot de passe est refusé, sinon les essais pourraient continuer.
        remaining = lockout.remaining_lock(email, ip)
        if remaining is not None:
            return Response(
                {'detail': lockout.lock_message(remaining), 'code': 'too_many_attempts'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={'Retry-After': str(max(1, int(remaining.total_seconds())))},
            )

        user = authenticate(request, email=email, password=password)
        if user is None:
            # Un compte désactivé n'est signalé qu'à la personne qui connaît son mot de passe.
            inactive = User.objects.filter(email__iexact=email, is_active=False).first()
            if inactive is not None and inactive.check_password(password):
                return Response(
                    {'detail': INACTIVE_ACCOUNT, 'code': 'inactive_account'}, status=status.HTTP_403_FORBIDDEN
                )
            lockout.record_failure(email, ip)
            return Response(
                {'detail': INVALID_CREDENTIALS, 'code': 'invalid_credentials'}, status=status.HTTP_400_BAD_REQUEST
            )

        lockout.clear_failures(email)
        login(request, user)
        if not serializer.validated_data['remember']:
            request.session.set_expiry(0)  # session fermée avec le navigateur
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    """Déconnexion ; sans effet si personne n'est connecté."""

    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class MeView(APIView):
    """Utilisateur connecté. Dépose aussi le cookie anti-CSRF dont le frontend a besoin."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ForgotPasswordView(APIView):
    """Demande d'un lien de réinitialisation. Même réponse que le compte existe ou non."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password_reset.request_reset(serializer.validated_data['email'])
        return Response({'detail': password_reset.REQUEST_ACKNOWLEDGED}, status=status.HTTP_202_ACCEPTED)


class PasswordResetCheckView(APIView):
    """Vérifie un lien de réinitialisation avant d'afficher le formulaire."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            link = password_reset.check_reset_link(serializer.validated_data['token'])
        except password_reset.LinkProblem as problem:
            return problem.response()
        return Response({'valid': True, 'expires_at': link.expires_at})


class PasswordResetView(APIView):
    """Enregistre le nouveau mot de passe choisi depuis le lien."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        token_serializer = TokenSerializer(data=request.data)
        token_serializer.is_valid(raise_exception=True)
        token = token_serializer.validated_data['token']
        try:
            link = password_reset.check_reset_link(token)
            serializer = PasswordResetSerializer(data=request.data, context={'user': link.user})
            serializer.is_valid(raise_exception=True)
            password_reset.reset_password(token, serializer.validated_data['password'])
        except password_reset.LinkProblem as problem:
            return problem.response()
        return Response({'detail': 'Votre mot de passe a été modifié. Vous pouvez vous connecter.'})


class InvitationCreateView(APIView):
    """Un fondateur invite une personne au bureau exécutif."""

    permission_classes = [IsFounder]

    def post(self, request):
        serializer = InvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = invitations.invite(invited_by=request.user, **serializer.validated_data)
        except EmailNotSent:
            return Response(
                {
                    'detail': "Le courriel d'invitation n'a pas pu être envoyé : aucun compte n'a été créé. "
                    'Réessayez dans quelques minutes.',
                    'code': 'email_not_sent',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(InvitationDetailSerializer(user).data, status=status.HTTP_201_CREATED)


class InvitationCheckView(APIView):
    """Vérifie le lien d'invitation avant d'afficher le choix du mot de passe."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            link = invitations.check_invitation(serializer.validated_data['token'])
        except password_reset.LinkProblem as problem:
            return problem.response()
        return Response({**InvitationDetailSerializer(link.user).data, 'expires_at': link.expires_at})


class InvitationAcceptView(APIView):
    """La personne invitée choisit son mot de passe ; sa session s'ouvre sur l'interface du bureau."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        token_serializer = TokenSerializer(data=request.data)
        token_serializer.is_valid(raise_exception=True)
        token = token_serializer.validated_data['token']
        try:
            link = invitations.check_invitation(token)
            serializer = PasswordResetSerializer(data=request.data, context={'user': link.user})
            serializer.is_valid(raise_exception=True)
            user = invitations.accept_invitation(token, serializer.validated_data['password'])
        except password_reset.LinkProblem as problem:
            return problem.response()
        login(request, user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
