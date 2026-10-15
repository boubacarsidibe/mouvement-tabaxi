from django.urls import path

from . import views

urlpatterns = [
    path('registration/check/', views.RegistrationCheckView.as_view(), name='registration-check'),
    path('registration/', views.RegistrationView.as_view(), name='registration'),
    path('members/me/', views.MyProfileView.as_view(), name='my-profile'),
    path('members/me/photo/', views.MyPhotoView.as_view(), name='my-photo'),
]
