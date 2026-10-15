from django.urls import path

from . import views

urlpatterns = [
    path('', views.ApplicationSubmitView.as_view(), name='application-submit'),
]
