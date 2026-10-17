from django.urls import path

from . import views

urlpatterns = [
    # Bureau exécutif
    path('programs/', views.ProgramListCreateView.as_view(), name='program-list'),
    path('programs/export/', views.ProgramExportView.as_view(), name='program-export'),
    path('programs/managers/', views.ProgramManagersView.as_view(), name='program-managers'),
    path('programs/<uuid:pk>/', views.ProgramDetailView.as_view(), name='program-detail'),
    path('programs/<uuid:pk>/activities/', views.ActivityCreateView.as_view(), name='activity-create'),
    path('activities/<uuid:pk>/', views.ActivityDetailView.as_view(), name='activity-detail'),
    path('activities/<uuid:pk>/report/', views.ActivityReportView.as_view(), name='activity-report'),
    path('activities/<uuid:pk>/attendance/', views.ActivityAttendanceView.as_view(), name='activity-attendance'),
    path('activities/<uuid:pk>/registrations/', views.ActivityRegistrationsView.as_view(), name='activity-registrations'),
    path(
        'activities/<uuid:pk>/registrations/export/',
        views.ActivityRegistrationsExportView.as_view(),
        name='activity-registrations-export',
    ),
    # Membre
    path('member/programs/', views.MemberProgramListView.as_view(), name='member-programs'),
    path('member/activities/<uuid:pk>/', views.MemberActivityView.as_view(), name='member-activity'),
    path('member/activities/<uuid:pk>/registration/', views.MemberRegistrationView.as_view(), name='member-registration'),
]
