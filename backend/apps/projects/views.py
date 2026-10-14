import logging

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.activity_log.models import ActivityLog
from apps.projects.models import Project, ProjectMember
from apps.projects.permissions import IsProjectAdmin, IsProjectMember
from apps.projects.serializers import (
    AddMemberSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectMemberSerializer,
    ProjectRevealSerializer,
    ProjectWriteSerializer,
)
from apps.projects.services import ProjectService
from utils.responses import error_response, success_response

logger = logging.getLogger(__name__)
User = get_user_model()


class ProjectListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/projects/          — list projects visible to the user
    POST /api/v1/projects/          — create a new project
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Annotate the five counts on the queryset so the list is served with a
        # single query instead of 5 x N `.count()` calls (one set per project).
        # distinct=True is required because annotating multiple reverse-FK joins
        # in one query would otherwise multiply/inflate the counts.
        return (
            ProjectService.get_projects_for_user(self.request.user)
            .select_related('created_by')
            .annotate(
                member_count=Count('members', distinct=True),
                env_count=Count('env_variables', distinct=True),
                license_count=Count('license_keys', distinct=True),
                admin_cred_count=Count('admin_credentials', distinct=True),
                app_user_count=Count('app_users', distinct=True),
            )
            # annotate() introduces a GROUP BY, which drops the model's default
            # Meta.ordering; re-assert it so the list stays newest-first and
            # pagination is deterministic.
            .order_by('-created_at')
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = ProjectListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = ProjectListSerializer(qs, many=True)
        return success_response('Projects retrieved.', data=serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = ProjectWriteSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        project = serializer.save()
        # Auto-add creator as ADMIN member
        ProjectMember.objects.create(
            project=project,
            user=request.user,
            role=ProjectMember.Role.ADMIN,
            added_by=request.user,
        )
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.CREATED,
            module_name='Project',
            object_id=str(project.id),
            description=f'Project "{project.name}" created.',
        )
        return success_response(
            'Project created.',
            data=ProjectDetailSerializer(project).data,
            status=201,
        )


class ProjectDetailView(APIView):
    """
    GET    /api/v1/projects/<project_id>/   — retrieve project (password masked)
    PATCH  /api/v1/projects/<project_id>/   — update project (project admin only)
    DELETE /api/v1/projects/<project_id>/   — delete project (system admin only)
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def _get_project(self, project_id):
        return get_object_or_404(Project.objects.select_related('created_by'), pk=project_id)

    def get(self, request, project_id):
        project = self._get_project(project_id)
        self.check_permissions(request)
        return success_response(
            'Project retrieved.',
            data=ProjectDetailSerializer(project).data,
        )

    def patch(self, request, project_id):
        project = self._get_project(project_id)
        # Require project-admin level for updates
        perm = IsProjectAdmin()
        if not perm.has_permission(request, self):
            return error_response(
                'You must be a project admin to update this project.',
                status=403,
            )
        serializer = ProjectWriteSerializer(
            project, data=request.data, partial=True, context={'request': request}
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        project = serializer.save()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.UPDATED,
            module_name='Project',
            object_id=str(project.id),
            description=f'Project "{project.name}" updated.',
        )
        return success_response(
            'Project updated.',
            data=ProjectDetailSerializer(project).data,
        )

    def delete(self, request, project_id):
        project = self._get_project(project_id)
        # Only system ADMIN can delete a whole project
        if request.user.role != 'ADMIN':
            return error_response(
                'Only system administrators can delete projects.',
                status=403,
            )
        name = project.name
        project.delete()
        return success_response(f'Project "{name}" deleted.')


class ProjectRevealView(APIView):
    """GET /api/v1/projects/<project_id>/reveal/ — decrypt project password."""

    permission_classes = [IsAuthenticated, IsProjectAdmin]

    def get(self, request, project_id):
        project = get_object_or_404(Project.objects.select_related('created_by'), pk=project_id)
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.REVEALED,
            module_name='Project',
            object_id=str(project.id),
            description=f'Project "{project.name}" password revealed.',
        )
        return success_response(
            'Project password revealed.',
            data=ProjectRevealSerializer(project).data,
        )


class ProjectMemberListCreateView(APIView):
    """
    GET  /api/v1/projects/<project_id>/members/  — list members
    POST /api/v1/projects/<project_id>/members/  — add member (project admin only)
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def _get_project(self, project_id):
        return get_object_or_404(Project, pk=project_id)

    def get(self, request, project_id):
        project = self._get_project(project_id)
        members = ProjectMember.objects.filter(project=project).select_related(
            'user', 'added_by'
        )
        serializer = ProjectMemberSerializer(members, many=True)
        return success_response('Members retrieved.', data=serializer.data)

    def post(self, request, project_id):
        project = self._get_project(project_id)
        # Only project admins may add members
        perm = IsProjectAdmin()
        if not perm.has_permission(request, self):
            return error_response(
                'Only project admins can add members.',
                status=403,
            )
        serializer = AddMemberSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)

        user_to_add = User.objects.get(pk=serializer.validated_data['user_id'])
        role = serializer.validated_data['role']
        try:
            membership = ProjectService.add_member(
                project=project,
                user_to_add=user_to_add,
                role=role,
                added_by=request.user,
            )
        except DjangoValidationError as exc:
            return error_response(exc.message, status=400)

        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.ADDED,
            module_name='ProjectMember',
            object_id=str(membership.pk),
            description=f'User "{user_to_add.email}" added as {role}.',
        )
        return success_response(
            'Member added.',
            data=ProjectMemberSerializer(membership).data,
            status=201,
        )


class ProjectMemberDeleteView(APIView):
    """DELETE /api/v1/projects/<project_id>/members/<user_id>/ — remove member."""

    permission_classes = [IsAuthenticated, IsProjectAdmin]

    def delete(self, request, project_id, user_id):
        project = get_object_or_404(Project, pk=project_id)
        user_to_remove = get_object_or_404(User, pk=user_id)
        try:
            ProjectService.remove_member(project=project, user_to_remove=user_to_remove)
        except DjangoValidationError as exc:
            return error_response(exc.message, status=400)

        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.DELETED,
            module_name='ProjectMember',
            object_id=str(user_id),
            description=f'User "{user_to_remove.email}" removed from project.',
        )
        return success_response('Member removed.')
