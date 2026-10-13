from django.urls import path

from apps.environment_credentials.views import (
    EnvironmentCredentialDetailView,
    EnvironmentCredentialListView,
    EnvironmentCredentialRevealView,
)

urlpatterns = [
    path('', EnvironmentCredentialListView.as_view(), name='environment-credentials-list'),
    path('<uuid:pk>/', EnvironmentCredentialDetailView.as_view(), name='environment-credentials-detail'),
    path('<uuid:pk>/reveal/', EnvironmentCredentialRevealView.as_view(), name='environment-credentials-reveal'),
]
