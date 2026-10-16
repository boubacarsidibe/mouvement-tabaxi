from django.urls import path

from . import views

urlpatterns = [
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('me/', views.MeView.as_view(), name='me'),
    path('password/forgot/', views.ForgotPasswordView.as_view(), name='password-forgot'),
    path('password/reset/check/', views.PasswordResetCheckView.as_view(), name='password-reset-check'),
    path('password/reset/', views.PasswordResetView.as_view(), name='password-reset'),
    path('invitations/', views.InvitationCreateView.as_view(), name='invitation-create'),
    path('invitation/check/', views.InvitationCheckView.as_view(), name='invitation-check'),
    path('invitation/accept/', views.InvitationAcceptView.as_view(), name='invitation-accept'),
]
