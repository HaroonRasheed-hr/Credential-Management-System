from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.teams.models import Team, TeamMember
from apps.teams.permissions import IsTeamAdmin, IsTeamMember
from apps.teams.serializers import (
    AddTeamMemberSerializer,
    CreateAndAddTeamMemberSerializer,
    TeamDetailSerializer,
    TeamListSerializer,
    TeamWriteSerializer,
    TeamMemberSerializer,
    UpdateTeamMemberSerializer,
)
from apps.projects.encryption import EncryptionService
from utils.responses import error_response, success_response

User = get_user_model()


class TeamListCreateView(APIView):
    """
    GET  /api/v1/teams/  — list teams visible to the user
    POST /api/v1/teams/  — create a team (system admin or authenticated user)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'ADMIN':
            teams = Team.objects.select_related('created_by').prefetch_related('members')
        else:
            # Return teams the user created or is a member of
            from django.db.models import Q
            teams = Team.objects.filter(
                Q(created_by=request.user) | Q(members__user=request.user)
            ).distinct().select_related('created_by').prefetch_related('members')

        serializer = TeamListSerializer(teams, many=True)
        return success_response('Teams retrieved.', data=serializer.data)

    def post(self, request):
        serializer = TeamWriteSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        team = serializer.save()
        # Auto-add creator as ADMIN member
        TeamMember.objects.create(
            team=team,
            user=request.user,
            role=TeamMember.Role.ADMIN,
            added_by=request.user,
        )
        return success_response(
            'Team created.',
            data=TeamDetailSerializer(team).data,
            status=201,
        )


class TeamDetailView(APIView):
    """
    GET    /api/v1/teams/<team_id>/  — retrieve team with members
    PATCH  /api/v1/teams/<team_id>/  — update team (team admin only)
    DELETE /api/v1/teams/<team_id>/  — delete team (system admin only)
    """

    permission_classes = [IsAuthenticated, IsTeamMember]

    def _get_team(self, team_id):
        return get_object_or_404(
            Team.objects.select_related('created_by').prefetch_related('members__user', 'members__added_by'),
            pk=team_id,
        )

    def get(self, request, team_id):
        team = self._get_team(team_id)
        return success_response('Team retrieved.', data=TeamDetailSerializer(team).data)

    def patch(self, request, team_id):
        team = self._get_team(team_id)
        perm = IsTeamAdmin()
        if not perm.has_permission(request, self):
            return error_response('You must be a team admin to update this team.', status=403)
        serializer = TeamWriteSerializer(
            team, data=request.data, partial=True, context={'request': request}
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        team = serializer.save()
        return success_response('Team updated.', data=TeamDetailSerializer(team).data)

    def delete(self, request, team_id):
        team = self._get_team(team_id)
        if request.user.role != 'ADMIN':
            return error_response('Only system administrators can delete teams.', status=403)
        name = team.name
        team.delete()
        return success_response(f'Team "{name}" deleted.')


class TeamMemberListCreateView(APIView):
    """
    POST /api/v1/teams/<team_id>/members/  — add a member (team admin only)
    """

    permission_classes = [IsAuthenticated, IsTeamAdmin]

    def post(self, request, team_id):
        team = get_object_or_404(Team, pk=team_id)
        serializer = AddTeamMemberSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)

        user_to_add = User.objects.get(pk=serializer.validated_data['user_id'])
        role = serializer.validated_data['role']

        if team.team_type == 'ADMIN' and user_to_add.role != 'ADMIN':
            return error_response('Only Admin users can be added to an Admin team.', status=400)

        if TeamMember.objects.filter(team=team, user=user_to_add).exists():
            return error_response('This user is already a member of the team.', status=400)

        membership = TeamMember.objects.create(
            team=team,
            user=user_to_add,
            role=role,
            added_by=request.user,
        )
        return success_response(
            'Member added.',
            data=TeamMemberSerializer(membership).data,
            status=201,
        )


class TeamMemberCreateUserView(APIView):
    """
    POST /api/v1/teams/<team_id>/members/create-user/
    Creates a new user account then immediately adds them to the team.
    Requires team admin permission.
    """

    permission_classes = [IsAuthenticated, IsTeamAdmin]

    def post(self, request, team_id):
        team = get_object_or_404(Team, pk=team_id)
        serializer = CreateAndAddTeamMemberSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)

        data = serializer.validated_data

        if team.team_type == 'ADMIN' and data['role'] != 'ADMIN':
            return error_response('Only Admin users can be added to an Admin team.', status=400)

        user = User.objects.create_user(
            email=data['email'],
            username=data['name'],
            password=data['password'],
            role=data['role'],
        )
        membership = TeamMember.objects.create(
            team=team,
            user=user,
            role=data['role'],
            added_by=request.user,
            password_plaintext=EncryptionService.encrypt(data['password']),
        )
        return success_response(
            'User created and added to team.',
            data=TeamMemberSerializer(membership).data,
            status=201,
        )


class TeamMemberDetailView(APIView):
    """
    PATCH  /api/v1/teams/<team_id>/members/<member_id>/  — update role (team admin only)
    DELETE /api/v1/teams/<team_id>/members/<member_id>/  — remove member (team admin only)
    """

    permission_classes = [IsAuthenticated, IsTeamAdmin]

    def _get_membership(self, team_id, member_id):
        return get_object_or_404(
            TeamMember.objects.select_related('user', 'added_by'),
            pk=member_id,
            team_id=team_id,
        )

    def patch(self, request, team_id, member_id):
        membership = self._get_membership(team_id, member_id)
        serializer = UpdateTeamMemberSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)

        data = serializer.validated_data
        user = membership.user
        user_fields = []

        if 'email' in data:
            if User.objects.filter(email__iexact=data['email']).exclude(pk=user.pk).exists():
                return error_response('A user with this email already exists.', status=400)
            user.email = data['email']
            user_fields.append('email')

        if 'password' in data:
            user.set_password(data['password'])
            user_fields.append('password')

        if user_fields:
            user.save(update_fields=user_fields)

        membership_fields = []
        if 'role' in data:
            membership.role = data['role']
            membership_fields.append('role')
        if 'password' in data:
            membership.password_plaintext = EncryptionService.encrypt(data['password'])
            membership_fields.append('password_plaintext')
        if membership_fields:
            membership.save(update_fields=membership_fields)

        return success_response('Member updated.', data=TeamMemberSerializer(membership).data)

    def delete(self, request, team_id, member_id):
        membership = self._get_membership(team_id, member_id)

        # Prevent removing the last admin
        if membership.role == TeamMember.Role.ADMIN:
            admin_count = TeamMember.objects.filter(
                team_id=team_id, role=TeamMember.Role.ADMIN
            ).count()
            if admin_count <= 1:
                return error_response(
                    'Cannot remove the last admin from the team. Promote another member first.',
                    status=400,
                )

        member_user = membership.user
        membership.delete()

        # Team members are provisioned via the create-user flow, so an account
        # left behind after the membership is removed keeps its email/username
        # reserved and blocks re-adding the same person. Deprovision the user
        # once it has no remaining team memberships. System admins and the
        # requesting user are never deleted as a safety guard.
        if (
            member_user.role != 'ADMIN'
            and member_user.pk != request.user.pk
            and not TeamMember.objects.filter(user=member_user).exists()
        ):
            member_user.delete()

        return success_response('Member removed.')


class TeamMemberRevealPasswordView(APIView):
    """GET /api/v1/teams/<team_id>/members/<member_id>/reveal/ — return decrypted password."""

    permission_classes = [IsAuthenticated, IsTeamAdmin]

    def get(self, request, team_id, member_id):
        membership = get_object_or_404(
            TeamMember.objects.select_related('user'),
            pk=member_id,
            team_id=team_id,
        )
        if not membership.password_plaintext:
            return error_response('Password not available for this member.', status=404)
        plaintext = EncryptionService.decrypt(membership.password_plaintext)
        return success_response('Password revealed.', data={'password': plaintext})
