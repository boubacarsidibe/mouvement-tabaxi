from django.contrib import admin

from .models import Member


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('membership_number', 'full_name', 'territory', 'status', 'joined_at')
    list_filter = ('status', 'territory')
    search_fields = ('membership_number', 'user__first_name', 'user__last_name', 'user__email')
    readonly_fields = ('membership_number', 'joined_at', 'updated_at')

    @admin.display(description='Nom')
    def full_name(self, member):
        return member.user.get_full_name()
