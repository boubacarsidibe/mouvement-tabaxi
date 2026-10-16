from django.contrib import admin

from .models import Territory


@admin.register(Territory)
class TerritoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'kind', 'parent', 'is_active')
    list_filter = ('kind', 'is_active')
    search_fields = ('name',)
    autocomplete_fields = ('parent',)
    list_select_related = ('parent',)
