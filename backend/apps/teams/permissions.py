from rest_framework.permissions import BasePermission

from apps.teams.models import Team, TeamMember


def _get_team(view) -> Team | None:
    team_id = view.kwargs.get('team_id')
    if not team_id:
        return None
    try:
        return Team.objects.get(pk=team_id)
    except Team.DoesNotExist:
        return None


def _is_system_admin(user) -> bool:
    return user.role == 'ADMIN'


def _get_membership(user, team) -> TeamMember | None:
    try:
        return TeamMember.objects.get(team=team, user=user)
    except TeamMember.DoesNotExist:
        return None


class IsTeamMember(BasePermission):
    """Allow access for system ADMIN, team creator, or any TeamMember."""

    message = 'You are not a member of this team.'

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if _is_system_admin(request.user):
            return True
        team = _get_team(view)
        if team is None:
            return False
        if team.created_by_id == request.user.pk:
            return True
        return TeamMember.objects.filter(team=team, user=request.user).exists()


class IsTeamAdmin(BasePermission):
    """Allow access for system ADMIN, team creator, or a TeamMember with ADMIN role."""

    message = 'You must be a team admin to perform this action.'

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if _is_system_admin(request.user):
            return True
        team = _get_team(view)
        if team is None:
            return False
        if team.created_by_id == request.user.pk:
            return True
        membership = _get_membership(request.user, team)
        return membership is not None and membership.role == TeamMember.Role.ADMIN
