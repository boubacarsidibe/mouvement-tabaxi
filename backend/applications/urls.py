from django.urls import path

from . import views

urlpatterns = [
    path('', views.ApplicationListCreateView.as_view(), name='application-list'),
    path('export/', views.ApplicationExportView.as_view(), name='application-export'),
    path('<int:pk>/', views.ApplicationDetailView.as_view(), name='application-detail'),
    path('<int:pk>/accept/', views.AcceptView.as_view(), name='application-accept'),
    path('<int:pk>/reject/', views.RejectView.as_view(), name='application-reject'),
]
