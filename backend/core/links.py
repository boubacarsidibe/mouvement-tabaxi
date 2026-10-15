"""Réponses communes aux liens personnels refusés : chaque message dit quoi faire."""

from rest_framework.response import Response


class LinkProblem(Exception):
    """Le lien ne permet pas (ou plus) l'action demandée."""

    def __init__(self, code, detail, status):
        super().__init__(detail)
        self.code, self.detail, self.status = code, detail, status

    def response(self):
        return Response({'detail': self.detail, 'code': self.code}, status=self.status)


def invalid_link(detail="Ce lien n'est pas valide. Vérifiez qu'il est complet."):
    return LinkProblem('invalid_link', detail, 404)


def expired_link(detail):
    return LinkProblem('link_expired', detail, 410)


def used_link(detail):
    return LinkProblem('link_used', detail, 410)
