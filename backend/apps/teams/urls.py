from django.urls import path

from apps.teams import views

urlpatterns = [
    # ── Teams ─────────────────────────────────────────────────────────────────
    path(
        '',
        views.TeamListCreateView.as_view(),
        name='team-list',
    ),
    path(
        'members/',
        views.OrganizationMembersView.as_view(),
        name='organization-members',
    ),
    path(
        '<uuid:team_id>/',
        views.TeamDetailView.as_view(),
        name='team-detail',
    ),

    # ── Team Members ──────────────────────────────────────────────────────────
    path(
        '<uuid:team_id>/members/',
        views.TeamMemberListCreateView.as_view(),
        name='team-member-list',
    ),
    path(
        '<uuid:team_id>/members/create-user/',
        views.TeamMemberCreateUserView.as_view(),
        name='team-member-create-user',
    ),
    path(
        '<uuid:team_id>/members/<uuid:member_id>/',
        views.TeamMemberDetailView.as_view(),
        name='team-member-detail',
    ),
    path(
        '<uuid:team_id>/members/<uuid:member_id>/reveal/',
        views.TeamMemberRevealPasswordView.as_view(),
        name='team-member-reveal-password',
    ),
]
