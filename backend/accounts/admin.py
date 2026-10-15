from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import LoginFailure, User


@admin.register(User)
class TabaxiUserAdmin(UserAdmin):
    ordering = ('email',)
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_active')
    list_filter = ('role', 'is_active')
    search_fields = ('email', 'first_name', 'last_name')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Identité', {'fields': ('first_name', 'last_name')}),
        ('Rôle et droits', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'role', 'password1', 'password2')}),
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
