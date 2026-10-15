from django.contrib import admin

from .models import Application, RegistrationLink


class RegistrationLinkInline(admin.TabularInline):
    """Liens personnels envoyés : dates seulement, le jeton n'est jamais conservé."""

    model = RegistrationLink
    fields = ('created_at', 'expires_at', 'used_at')
    readonly_fields = fields
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    """Consultation des demandes. Les décisions passent par l'API d'examen, qui envoie les courriels."""

    list_display = ('reference', 'last_name', 'first_name', 'email', 'territory', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('reference', 'last_name', 'first_name', 'email')
    list_select_related = ('territory',)
    date_hierarchy = 'created_at'
    inlines = [RegistrationLinkInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
