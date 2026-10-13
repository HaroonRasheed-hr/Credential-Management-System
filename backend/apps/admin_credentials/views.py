import logging

from django.shortcuts import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.activity_log.models import ActivityLog
from apps.admin_credentials.models import AdminCredential
from apps.admin_credentials.serializers import (
    AdminCredentialListSerializer,
    AdminCredentialRevealSerializer,
    AdminCredentialWriteSerializer,
)
from apps.projects.models import Project
from apps.projects.permissions import can_delete_own_or_admin, IsProjectMember
from apps.projects.services import ProjectService
from utils.responses import error_response, paginated_success_response, success_response

logger = logging.getLogger(__name__)


def _get_project_or_404(project_id):
    return get_object_or_404(Project, pk=project_id)


class AdminCredentialListCreateView(APIView):
    """
    GET  /api/v1/projects/<project_id>/admin-credentials/
    POST /api/v1/projects/<project_id>/admin-credentials/
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        creds = AdminCredential.objects.filter(project=project).select_related('updated_by')
        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(creds, request)
        if page is not None:
            serializer = AdminCredentialListSerializer(page, many=True)
            return paginated_success_response(paginator, serializer.data, 'Admin credentials retrieved.')
        serializer = AdminCredentialListSerializer(creds, many=True)
        return success_response('Admin credentials retrieved.', data=serializer.data)

    def post(self, request, project_id):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        serializer = AdminCredentialWriteSerializer(
            data=request.data,
            context={'request': request, 'project': project},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        cred = serializer.save()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.CREATED,
            module_name='AdminCredential',
            object_id=str(cred.id),
            description=f'Admin credential for "{cred.admin_panel_url}" created.',
        )
        return success_response(
            'Admin credential created.',
            data=AdminCredentialListSerializer(cred).data,
            status=201,
        )


class AdminCredentialDetailView(APIView):
    """
    PATCH  /api/v1/projects/<project_id>/admin-credentials/<pk>/
    DELETE /api/v1/projects/<project_id>/admin-credentials/<pk>/
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def _get_object(self, project_id, pk):
        project = _get_project_or_404(project_id)
        cred = get_object_or_404(AdminCredential, pk=pk, project=project)
        return project, cred

    def patch(self, request, project_id, pk):
        project, cred = self._get_object(project_id, pk)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        serializer = AdminCredentialWriteSerializer(
            cred,
            data=request.data,
            partial=True,
            context={'request': request, 'project': project},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        cred = serializer.save()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.UPDATED,
            module_name='AdminCredential',
            object_id=str(cred.id),
            description=f'Admin credential for "{cred.admin_panel_url}" updated.',
        )
        return success_response(
            'Admin credential updated.',
            data=AdminCredentialListSerializer(cred).data,
        )

    def delete(self, request, project_id, pk):
        project, cred = self._get_object(project_id, pk)
        if not can_delete_own_or_admin(request, self, cred):
            return error_response('You can only delete admin credentials you added.', status=403)
        url = cred.admin_panel_url
        cred_id = str(cred.id)
        cred.delete()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.DELETED,
            module_name='AdminCredential',
            object_id=cred_id,
            description=f'Admin credential for "{url}" deleted.',
        )
        return success_response('Admin credential deleted.')


class AdminCredentialRevealView(APIView):
    """GET /api/v1/projects/<project_id>/admin-credentials/<pk>/reveal/"""

    permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id, pk):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        cred = get_object_or_404(AdminCredential, pk=pk, project=project)
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.REVEALED,
            module_name='AdminCredential',
            object_id=str(cred.id),
            description=f'Admin credential for "{cred.admin_panel_url}" password revealed.',
        )
        return success_response(
            'Admin credential revealed.',
            data=AdminCredentialRevealSerializer(cred).data,
        )
