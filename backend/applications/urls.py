from django.urls import path

from . import views

urlpatterns = [
    path('', views.ApplicationListCreateView.as_view(), name='application-list'),
    path('export/', views.ApplicationExportView.as_view(), name='application-export'),
    path('<uuid:pk>/', views.ApplicationDetailView.as_view(), name='application-detail'),
    path('<uuid:pk>/accept/', views.AcceptView.as_view(), name='application-accept'),
    path('<uuid:pk>/reject/', views.RejectView.as_view(), name='application-reject'),
    path('<uuid:pk>/resend-link/', views.ResendLinkView.as_view(), name='application-resend-link'),
]
