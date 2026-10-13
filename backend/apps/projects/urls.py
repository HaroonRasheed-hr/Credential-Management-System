from django.urls import path

from apps.activity_log import views as al_views
from apps.admin_credentials import views as ac_views
from apps.app_users import views as au_views
from apps.env_variables import views as env_views
from apps.environment_credentials import views as ec_views
from apps.license_keys import views as lk_views
from apps.projects import views as project_views

urlpatterns = [
    # ── Projects ─────────────────────────────────────────────────────────────
    path(
        '',
        project_views.ProjectListCreateView.as_view(),
        name='project-list',
    ),
    path(
        '<uuid:project_id>/',
        project_views.ProjectDetailView.as_view(),
        name='project-detail',
    ),
    path(
        '<uuid:project_id>/reveal/',
        project_views.ProjectRevealView.as_view(),
        name='project-reveal',
    ),

    # ── Members / Team (both aliases point to the same views) ────────────────
    path(
        '<uuid:project_id>/members/',
        project_views.ProjectMemberListCreateView.as_view(),
        name='project-members',
    ),
    path(
        '<uuid:project_id>/members/<uuid:user_id>/',
        project_views.ProjectMemberDeleteView.as_view(),
        name='project-member-delete',
    ),
    path(
        '<uuid:project_id>/team/',
        project_views.ProjectMemberListCreateView.as_view(),
        name='team-list',
    ),
    path(
        '<uuid:project_id>/team/<uuid:user_id>/',
        project_views.ProjectMemberDeleteView.as_view(),
        name='team-delete',
    ),

    # ── Env Variables ─────────────────────────────────────────────────────────
    path(
        '<uuid:project_id>/env-variables/',
        env_views.EnvVariableListCreateView.as_view(),
        name='env-variable-list',
    ),
    path(
        '<uuid:project_id>/env-variables/<uuid:pk>/',
        env_views.EnvVariableDetailView.as_view(),
        name='env-variable-detail',
    ),
    path(
        '<uuid:project_id>/env-variables/<uuid:pk>/reveal/',
        env_views.EnvVariableRevealView.as_view(),
        name='env-variable-reveal',
    ),

    # ── License Keys ──────────────────────────────────────────────────────────
    path(
        '<uuid:project_id>/license-keys/',
        lk_views.LicenseKeyListCreateView.as_view(),
        name='license-key-list',
    ),
    path(
        '<uuid:project_id>/license-keys/<uuid:pk>/',
        lk_views.LicenseKeyDetailView.as_view(),
        name='license-key-detail',
    ),
    path(
        '<uuid:project_id>/license-keys/<uuid:pk>/reveal/',
        lk_views.LicenseKeyRevealView.as_view(),
        name='license-key-reveal',
    ),

    # ── Admin Credentials ─────────────────────────────────────────────────────
    path(
        '<uuid:project_id>/admin-credentials/',
        ac_views.AdminCredentialListCreateView.as_view(),
        name='admin-cred-list',
    ),
    path(
        '<uuid:project_id>/admin-credentials/<uuid:pk>/',
        ac_views.AdminCredentialDetailView.as_view(),
        name='admin-cred-detail',
    ),
    path(
        '<uuid:project_id>/admin-credentials/<uuid:pk>/reveal/',
        ac_views.AdminCredentialRevealView.as_view(),
        name='admin-cred-reveal',
    ),

    # ── Environment Credentials ───────────────────────────────────────────────
    path(
        '<uuid:project_id>/environment-credentials/',
        ec_views.EnvironmentCredentialListView.as_view(),
        name='environment-cred-list',
    ),
    path(
        '<uuid:project_id>/environment-credentials/<uuid:pk>/',
        ec_views.EnvironmentCredentialDetailView.as_view(),
        name='environment-cred-detail',
    ),
    path(
        '<uuid:project_id>/environment-credentials/<uuid:pk>/reveal/',
        ec_views.EnvironmentCredentialRevealView.as_view(),
        name='environment-cred-reveal',
    ),

    # ── App Users ─────────────────────────────────────────────────────────────
    path(
        '<uuid:project_id>/app-users/',
        au_views.AppUserListCreateView.as_view(),
        name='app-user-list',
    ),
    path(
        '<uuid:project_id>/app-users/<uuid:pk>/',
        au_views.AppUserDetailView.as_view(),
        name='app-user-detail',
    ),
    path(
        '<uuid:project_id>/app-users/<uuid:pk>/reveal/',
        au_views.AppUserRevealView.as_view(),
        name='app-user-reveal',
    ),

    # ── Activity Log ──────────────────────────────────────────────────────────
    path(
        '<uuid:project_id>/activity-log/',
        al_views.ActivityLogListView.as_view(),
        name='activity-log',
    ),
]
