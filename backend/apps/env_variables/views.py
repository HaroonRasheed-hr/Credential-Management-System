import logging

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.activity_log.models import ActivityLog
from apps.env_variables.models import EnvVariable
from apps.env_variables.serializers import (
    EnvVariableListSerializer,
    EnvVariableRevealSerializer,
    EnvVariableWriteSerializer,
)
from apps.projects.models import Project
from apps.projects.permissions import can_delete_own_or_admin, IsProjectMember
from apps.projects.services import ProjectService
from utils.responses import error_response, success_response

logger = logging.getLogger(__name__)


def _get_project_or_404(project_id):
    return get_object_or_404(Project, pk=project_id)


class EnvVariableListCreateView(APIView):
    """
    GET  /api/v1/projects/<project_id>/env-variables/
    POST /api/v1/projects/<project_id>/env-variables/
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        env = EnvVariable.objects.filter(project=project).select_related('updated_by')

        # Optional filter by environment query param
        environment = request.query_params.get('environment')
        if environment:
            env = env.filter(environment=environment.upper())

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(env, request)
        if page is not None:
            serializer = EnvVariableListSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = EnvVariableListSerializer(env, many=True)
        return success_response('Env variables retrieved.', data=serializer.data)

    def post(self, request, project_id):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        serializer = EnvVariableWriteSerializer(
            data=request.data,
            context={'request': request, 'project': project},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        env_var = serializer.save()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.CREATED,
            module_name='EnvVariable',
            object_id=str(env_var.id),
            description=f'Env variable "{env_var.key}" ({env_var.environment}) created.',
        )
        return success_response(
            'Env variable created.',
            data=EnvVariableListSerializer(env_var).data,
            status=201,
        )


class EnvVariableDetailView(APIView):
    """
    PATCH  /api/v1/projects/<project_id>/env-variables/<pk>/
    DELETE /api/v1/projects/<project_id>/env-variables/<pk>/
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def _get_object(self, project_id, pk):
        project = _get_project_or_404(project_id)
        env_var = get_object_or_404(EnvVariable, pk=pk, project=project)
        return project, env_var

    def patch(self, request, project_id, pk):
        project, env_var = self._get_object(project_id, pk)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        serializer = EnvVariableWriteSerializer(
            env_var,
            data=request.data,
            partial=True,
            context={'request': request, 'project': project},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        env_var = serializer.save()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.UPDATED,
            module_name='EnvVariable',
            object_id=str(env_var.id),
            description=f'Env variable "{env_var.key}" ({env_var.environment}) updated.',
        )
        return success_response(
            'Env variable updated.',
            data=EnvVariableListSerializer(env_var).data,
        )

    def delete(self, request, project_id, pk):
        project, env_var = self._get_object(project_id, pk)
        if not can_delete_own_or_admin(request, self, env_var):
            return error_response('You can only delete env variables you added.', status=403)
        key = env_var.key
        env_name = env_var.environment
        env_var_id = str(env_var.id)
        env_var.delete()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.DELETED,
            module_name='EnvVariable',
            object_id=env_var_id,
            description=f'Env variable "{key}" ({env_name}) deleted.',
        )
        return success_response('Env variable deleted.')


class EnvVariableRevealView(APIView):
    """GET /api/v1/projects/<project_id>/env-variables/<pk>/reveal/"""

    permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id, pk):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        env_var = get_object_or_404(EnvVariable, pk=pk, project=project)
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.REVEALED,
            module_name='EnvVariable',
            object_id=str(env_var.id),
            description=f'Env variable "{env_var.key}" ({env_var.environment}) value revealed.',
        )
        return success_response(
            'Env variable revealed.',
            data=EnvVariableRevealSerializer(env_var).data,
        )
