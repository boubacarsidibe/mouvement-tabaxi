from django.urls import path

from . import views

urlpatterns = [
    path('', views.territory_tree, name='territory-tree'),
]
