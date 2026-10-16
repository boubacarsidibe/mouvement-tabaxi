from django.contrib import admin

from .models import Member, MemberStatusChange


class MemberStatusChangeInline(admin.TabularInline):
    """Historique des statuts : en lecture seule, il ne se modifie pas."""

    model = MemberStatusChange
    extra = 0
    can_delete = False
    fields = ('changed_at', 'from_status', 'to_status', 'reason', 'changed_by')
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('number', 'user', 'status', 'joined_on')
    list_filter = ('status',)
    search_fields = ('number', 'user__email', 'user__first_name', 'user__last_name')
    # Le statut se change depuis l'interface du bureau (fondateurs), qui garde l'historique.
    readonly_fields = ('number', 'status', 'created_at', 'updated_at')
    autocomplete_fields = ('user',)
    date_hierarchy = 'joined_on'
    inlines = [MemberStatusChangeInline]

    def has_delete_permission(self, request, obj=None):
        return False  # un dossier de membre se conserve, même après une radiation
