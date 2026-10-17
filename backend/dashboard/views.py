from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsBureau
from audit.serializers import AuditEntrySerializer

from . import services


class DashboardView(APIView):
    """Chiffres du tableau de bord du bureau, limités au territoire de la personne connectée."""

    permission_classes = [IsBureau]

    def get(self, request):
        data = services.build(request.user)
        if data['recent_actions'] is not None:
            data['recent_actions'] = AuditEntrySerializer(data['recent_actions'], many=True).data
        return Response(data)
