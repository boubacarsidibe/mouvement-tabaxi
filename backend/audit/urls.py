from django.urls import path

from . import views

urlpatterns = [
    path('', views.AuditListView.as_view(), name='audit-list'),
    path('actors/', views.AuditActorsView.as_view(), name='audit-actors'),
]
