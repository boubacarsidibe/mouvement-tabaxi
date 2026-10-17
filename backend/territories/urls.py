from django.urls import path

from . import views

urlpatterns = [
    path('', views.territory_tree, name='territory-tree'),
    path('managed/', views.ManagedTerritoryListView.as_view(), name='territory-managed'),
    path('managed/<int:pk>/', views.ManagedTerritoryDetailView.as_view(), name='territory-managed-detail'),
]
