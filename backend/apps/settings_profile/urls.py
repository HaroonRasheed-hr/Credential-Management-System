from django.urls import path

from .views import ChangePasswordView, ProfileView

urlpatterns = [
    path('profile/', ProfileView.as_view(), name='settings-profile'),
    path('change-password/', ChangePasswordView.as_view(), name='settings-change-password'),
]
