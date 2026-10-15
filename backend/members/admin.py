from django.contrib import admin

from .models import Member


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('number', 'user', 'joined_on')
    search_fields = ('number', 'user__email', 'user__first_name', 'user__last_name')
    readonly_fields = ('number', 'created_at', 'updated_at')
    autocomplete_fields = ('user',)
    date_hierarchy = 'joined_on'
