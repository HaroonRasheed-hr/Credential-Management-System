import logging

from django.shortcuts import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.activity_log.models import ActivityLog
from apps.license_keys.models import LicenseKey
from apps.license_keys.serializers import (
    LicenseKeyListSerializer,
    LicenseKeyRevealSerializer,
    LicenseKeyWriteSerializer,
)
from apps.projects.models import Project
from apps.projects.permissions import can_delete_own_or_admin, IsProjectMember
from apps.projects.services import ProjectService
from utils.responses import error_response, paginated_success_response, success_response

logger = logging.getLogger(__name__)


def _get_project_or_404(project_id):
    return get_object_or_404(Project, pk=project_id)


class LicenseKeyListCreateView(APIView):
    """
    GET  /api/v1/projects/<project_id>/license-keys/
    POST /api/v1/projects/<project_id>/license-keys/
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        keys = LicenseKey.objects.filter(project=project).select_related('updated_by')
        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(keys, request)
        if page is not None:
            serializer = LicenseKeyListSerializer(page, many=True)
            return paginated_success_response(paginator, serializer.data, 'License keys retrieved.')
        serializer = LicenseKeyListSerializer(keys, many=True)
        return success_response('License keys retrieved.', data=serializer.data)

    def post(self, request, project_id):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        serializer = LicenseKeyWriteSerializer(
            data=request.data,
            context={'request': request, 'project': project},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        lk = serializer.save()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.CREATED,
            module_name='LicenseKey',
            object_id=str(lk.id),
            description=f'License key "{lk.license_name}" created.',
        )
        return success_response(
            'License key created.',
            data=LicenseKeyListSerializer(lk).data,
            status=201,
        )


class LicenseKeyDetailView(APIView):
    """
    PATCH  /api/v1/projects/<project_id>/license-keys/<pk>/
    DELETE /api/v1/projects/<project_id>/license-keys/<pk>/
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def _get_object(self, project_id, pk):
        project = _get_project_or_404(project_id)
        lk = get_object_or_404(LicenseKey, pk=pk, project=project)
        return project, lk

    def patch(self, request, project_id, pk):
        project, lk = self._get_object(project_id, pk)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        serializer = LicenseKeyWriteSerializer(
            lk,
            data=request.data,
            partial=True,
            context={'request': request, 'project': project},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        lk = serializer.save()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.UPDATED,
            module_name='LicenseKey',
            object_id=str(lk.id),
            description=f'License key "{lk.license_name}" updated.',
        )
        return success_response(
            'License key updated.',
            data=LicenseKeyListSerializer(lk).data,
        )

    def delete(self, request, project_id, pk):
        project, lk = self._get_object(project_id, pk)
        if not can_delete_own_or_admin(request, self, lk):
            return error_response('You can only delete license keys you added.', status=403)
        name = lk.license_name
        lk_id = str(lk.id)
        lk.delete()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.DELETED,
            module_name='LicenseKey',
            object_id=lk_id,
            description=f'License key "{name}" deleted.',
        )
        return success_response('License key deleted.')


class LicenseKeyRevealView(APIView):
    """GET /api/v1/projects/<project_id>/license-keys/<pk>/reveal/"""

    permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id, pk):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        lk = get_object_or_404(LicenseKey, pk=pk, project=project)
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.REVEALED,
            module_name='LicenseKey',
            object_id=str(lk.id),
            description=f'License key "{lk.license_name}" revealed.',
        )
        return success_response(
            'License key revealed.',
            data=LicenseKeyRevealSerializer(lk).data,
        )
