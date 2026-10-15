from django.db import IntegrityError
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from .serializers import ALREADY_IN_PROGRESS, ApplicationSubmitSerializer


class ApplicationSubmitView(generics.CreateAPIView):
    """Dépôt public d'une demande d'adhésion, sans compte."""

    serializer_class = ApplicationSubmitSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'adhesion'

    def perform_create(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            # Deux envois simultanés avec le même courriel : la base garde le premier.
            raise ValidationError({'email': [ALREADY_IN_PROGRESS]})
