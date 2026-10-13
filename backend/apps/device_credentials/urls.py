from django.urls import path

from apps.device_credentials import views

urlpatterns = [
    # List all / create new
    path(
        '',
        views.DeviceCredentialListCreateView.as_view(),
        name='device-cred-list',
    ),
    # Update / delete a single record
    path(
        '<uuid:pk>/',
        views.DeviceCredentialDetailView.as_view(),
        name='device-cred-detail',
    ),
    # Reveal decrypted passwords for a single record
    path(
        '<uuid:pk>/reveal/',
        views.DeviceCredentialRevealView.as_view(),
        name='device-cred-reveal',
    ),
    # Project-device assignments
    path(
        'projects/<uuid:project_id>/',
        views.ProjectDeviceListCreateView.as_view(),
        name='project-device-list',
    ),
    path(
        'projects/<uuid:project_id>/<uuid:device_id>/',
        views.ProjectDeviceDeleteView.as_view(),
        name='project-device-delete',
    ),
]
