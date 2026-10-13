import logging

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.activity_log.models import ActivityLog
from apps.environment_credentials.models import EnvironmentCredential
from apps.environment_credentials.serializers import (
    EnvironmentCredentialListSerializer,
    EnvironmentCredentialRevealSerializer,
    EnvironmentCredentialWriteSerializer,
)
from apps.projects.models import Project
from apps.projects.permissions import IsProjectMember
from apps.projects.services import ProjectService
from utils.responses import error_response, success_response

logger = logging.getLogger(__name__)


def _get_project_or_404(project_id):
    return get_object_or_404(Project, pk=project_id)


class EnvironmentCredentialListView(APIView):
    """
    GET /api/v1/projects/<project_id>/environment-credentials/
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        
        creds = EnvironmentCredential.objects.filter(project=project).select_related('updated_by')
        serializer = EnvironmentCredentialListSerializer(creds, many=True)
        return success_response('Environment credentials retrieved.', data=serializer.data)


class EnvironmentCredentialDetailView(APIView):
    """
    PATCH /api/v1/projects/<project_id>/environment-credentials/<pk>/
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def _get_object(self, project_id, pk):
        project = _get_project_or_404(project_id)
        cred = get_object_or_404(EnvironmentCredential, pk=pk, project=project)
        return project, cred

    def patch(self, request, project_id, pk):
        project, cred = self._get_object(project_id, pk)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        
        serializer = EnvironmentCredentialWriteSerializer(
            cred,
            data=request.data,
            partial=True,
            context={'request': request, 'project': project, 'environment_type': cred.environment_type},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        
        cred = serializer.save()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.UPDATED,
            module_name='EnvironmentCredential',
            object_id=str(cred.id),
            description=f'{cred.environment_type} environment credentials updated.',
        )
        return success_response(
            'Environment credentials updated.',
            data=EnvironmentCredentialListSerializer(cred).data,
        )


class EnvironmentCredentialRevealView(APIView):
    """GET /api/v1/projects/<project_id>/environment-credentials/<pk>/reveal/"""

    permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id, pk):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        
        cred = get_object_or_404(EnvironmentCredential, pk=pk, project=project)
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.REVEALED,
            module_name='EnvironmentCredential',
            object_id=str(cred.id),
            description=f'{cred.environment_type} environment credentials revealed.',
        )
        return success_response(
            'Environment credentials revealed.',
            data=EnvironmentCredentialRevealSerializer(cred).data,
        )
