from django.contrib import admin

from .models import Activity, Program


class ActivityInline(admin.TabularInline):
    model = Activity
    extra = 0
    can_delete = False
    fields = ('title', 'starts_at', 'place')
    readonly_fields = fields
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    """Les programmes se gèrent depuis l'interface du bureau ; l'administration les consulte et les corrige."""

    list_display = ('name', 'territory', 'status', 'start_date', 'end_date', 'manager')
    list_filter = ('status',)
    search_fields = ('name', 'objective')
    autocomplete_fields = ('territory', 'manager')
    readonly_fields = ('created_by', 'created_at', 'updated_at')
    inlines = [ActivityInline]

    def has_delete_permission(self, request, obj=None):
        return False  # un programme garde sa mémoire : on l'annule ou on le termine


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ('title', 'program', 'starts_at', 'place')
    search_fields = ('title', 'place', 'program__name')
    list_select_related = ('program',)
    readonly_fields = (
        'report', 'report_author', 'reported_at', 'attendance_noted_at', 'attendance_noted_by', 'created_by',
        'created_at', 'updated_at',
    )
    autocomplete_fields = ('program',)

    def has_delete_permission(self, request, obj=None):
        return False
