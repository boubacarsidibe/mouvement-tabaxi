from rest_framework import serializers

from .models import AuditEntry


def describe(entry):
    """Phrase qui complète l'action, tirée des détails enregistrés."""
    d = entry.details
    action = AuditEntry.Action
    if entry.action in (action.APPLICATION_ACCEPTED, action.APPLICATION_REJECTED, action.LINK_RESENT):
        text = ' · '.join(part for part in (d.get('reference'), d.get('territory')) if part)
        if d.get('reason'):
            text += f" · Motif : {d['reason']}"
        return text
    if entry.action == action.STATUS_CHANGED:
        text = f"{d.get('from_label', '')} → {d.get('to_label', '')}"
        if d.get('number'):
            text = f"{d['number']} · {text}"
        if d.get('reason'):
            text += f" · Motif : {d['reason']}"
        return text
    if entry.action == action.INVITATION_SENT:
        return ' · '.join(part for part in (d.get('role_label'), d.get('territory') or 'Tous les territoires', d.get('email')) if part)
    if entry.action == action.LIST_EXPORTED:
        rows = d.get('rows', 0)
        text = f"{rows} ligne{'s' if rows > 1 else ''}"
        filters = d.get('filters') or {}
        if filters:
            text += ' · ' + ', '.join(f'{label} : {value}' for label, value in filters.items())
        return text
    return ''


class AuditEntrySerializer(serializers.ModelSerializer):
    action_label = serializers.CharField(source='get_action_display', read_only=True)
    category = serializers.SerializerMethodField()
    category_label = serializers.SerializerMethodField()
    detail = serializers.SerializerMethodField()
    actor = serializers.SerializerMethodField()

    class Meta:
        model = AuditEntry
        fields = ('id', 'action', 'action_label', 'category', 'category_label', 'subject', 'detail', 'actor', 'created_at')
        read_only_fields = fields

    def get_category(self, entry):
        return entry.category[0]

    def get_category_label(self, entry):
        return entry.category[1]

    def get_detail(self, entry):
        return describe(entry)

    def get_actor(self, entry):
        return {'id': entry.actor_id, 'name': entry.actor_name}
