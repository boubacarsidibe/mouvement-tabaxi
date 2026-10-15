from django.urls import path

from . import views

urlpatterns = [
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('me/', views.MeView.as_view(), name='me'),
    path('password/forgot/', views.ForgotPasswordView.as_view(), name='password-forgot'),
    path('password/reset/check/', views.PasswordResetCheckView.as_view(), name='password-reset-check'),
    path('password/reset/', views.PasswordResetView.as_view(), name='password-reset'),
    path('password/change/', views.PasswordChangeView.as_view(), name='password-change'),
]
