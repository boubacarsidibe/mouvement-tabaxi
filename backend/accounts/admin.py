from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from members.models import Member

from .models import LoginFailure, User


@admin.register(User)
class TabaxiUserAdmin(UserAdmin):
    ordering = ('email',)
    list_display = ('email', 'first_name', 'last_name', 'role', 'territory', 'is_active')
    list_filter = ('role', 'is_active')
    list_select_related = ('territory',)
    autocomplete_fields = ('territory',)
    search_fields = ('email', 'first_name', 'last_name')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Identité', {'fields': ('first_name', 'last_name')}),
        ('Rôle et droits', {'fields': ('role', 'territory', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'date_joined')}),
    )
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if not change and obj.is_bureau and obj.has_usable_password():
            Member.objects.get_or_create(user=obj)  # un compte du bureau a son dossier et sa carte

    def get_readonly_fields(self, request, obj=None):
        readonly = super().get_readonly_fields(request, obj)
        # Pour un membre, l'accès suit son statut : on le change depuis la fiche du membre.
        if obj is not None and hasattr(obj, 'member'):
            readonly = (*readonly, 'is_active')
        return readonly

    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'role', 'territory', 'password1', 'password2')}),
    )


@admin.register(LoginFailure)
class LoginFailureAdmin(admin.ModelAdmin):
    """Échecs de connexion récents (effacés après un jour), en lecture seule."""

    list_display = ('created_at', 'email', 'ip_address')
    search_fields = ('email', 'ip_address')
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
