from django.urls import path

from . import views

urlpatterns = [
    path('registration/check/', views.RegistrationCheckView.as_view(), name='registration-check'),
    path('registration/', views.RegistrationView.as_view(), name='registration'),
    path('members/', views.MemberListView.as_view(), name='member-list'),
    path('members/export/', views.MemberExportView.as_view(), name='member-export'),
    path('members/me/', views.MyProfileView.as_view(), name='my-profile'),
    path('members/me/photo/', views.MyPhotoView.as_view(), name='my-photo'),
    path('members/<uuid:pk>/', views.MemberDetailView.as_view(), name='member-detail'),
    path('members/<uuid:pk>/photo/', views.MemberPhotoView.as_view(), name='member-photo'),
    path('members/<uuid:pk>/status/', views.MemberStatusView.as_view(), name='member-status'),
]
