"""Routes du projet : administration Django et API REST sous /api/."""

from django.contrib import admin
from django.urls import include, path

from core.views import health

api_patterns = [
    path('health/', health, name='health'),
    path('auth/', include('accounts.urls')),
    path('territories/', include('territories.urls')),
    path('applications/', include('applications.urls')),
    path('audit/', include('audit.urls')),
    path('', include('members.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(api_patterns)),
]
