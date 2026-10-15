from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AccountLink, LoginFailure, User


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


@admin.register(AccountLink)
class AccountLinkAdmin(admin.ModelAdmin):
    """Liens envoyés (réinitialisation, invitation) : dates seulement, le jeton n'est jamais conservé."""

    list_display = ('user', 'purpose', 'created_at', 'expires_at', 'used_at')
    list_filter = ('purpose',)
    search_fields = ('user__email',)
    fields = ('user', 'purpose', 'created_at', 'expires_at', 'used_at')
    readonly_fields = fields

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
