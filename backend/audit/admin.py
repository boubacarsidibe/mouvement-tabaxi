from django.contrib import admin

from .models import AuditEntry


@admin.register(AuditEntry)
class AuditEntryAdmin(admin.ModelAdmin):
    """Le journal se consulte ici, il ne s'y modifie pas et ne s'y efface pas."""

    list_display = ('created_at', 'action', 'subject', 'actor_name')
    list_filter = ('action',)
    search_fields = ('actor_name', 'subject')
    date_hierarchy = 'created_at'
    fields = ('created_at', 'action', 'actor_name', 'subject', 'details')
    readonly_fields = fields

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
