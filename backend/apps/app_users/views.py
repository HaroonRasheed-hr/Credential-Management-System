import logging

from django.shortcuts import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.activity_log.models import ActivityLog
from apps.app_users.models import AppUser
from apps.app_users.serializers import (
    AppUserListSerializer,
    AppUserRevealSerializer,
    AppUserWriteSerializer,
)
from apps.projects.models import Project
from apps.projects.permissions import can_delete_own_or_admin, IsProjectMember
from apps.projects.services import ProjectService
from utils.responses import error_response, paginated_success_response, success_response

logger = logging.getLogger(__name__)


def _get_project_or_404(project_id):
    return get_object_or_404(Project, pk=project_id)


class AppUserListCreateView(APIView):
    """
    GET  /api/v1/projects/<project_id>/app-users/
    POST /api/v1/projects/<project_id>/app-users/
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        users = AppUser.objects.filter(project=project).select_related('updated_by')
        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(users, request)
        if page is not None:
            serializer = AppUserListSerializer(page, many=True)
            return paginated_success_response(paginator, serializer.data, 'App users retrieved.')
        serializer = AppUserListSerializer(users, many=True)
        return success_response('App users retrieved.', data=serializer.data)

    def post(self, request, project_id):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        serializer = AppUserWriteSerializer(
            data=request.data,
            context={'request': request, 'project': project},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        app_user = serializer.save()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.CREATED,
            module_name='AppUser',
            object_id=str(app_user.id),
            description=f'App user "{app_user.username}" ({app_user.role_in_app}) created.',
        )
        return success_response(
            'App user created.',
            data=AppUserListSerializer(app_user).data,
            status=201,
        )


class AppUserDetailView(APIView):
    """
    PATCH  /api/v1/projects/<project_id>/app-users/<pk>/
    DELETE /api/v1/projects/<project_id>/app-users/<pk>/
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def _get_object(self, project_id, pk):
        project = _get_project_or_404(project_id)
        app_user = get_object_or_404(AppUser, pk=pk, project=project)
        return project, app_user

    def patch(self, request, project_id, pk):
        project, app_user = self._get_object(project_id, pk)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        serializer = AppUserWriteSerializer(
            app_user,
            data=request.data,
            partial=True,
            context={'request': request, 'project': project},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        app_user = serializer.save()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.UPDATED,
            module_name='AppUser',
            object_id=str(app_user.id),
            description=f'App user "{app_user.username}" updated.',
        )
        return success_response(
            'App user updated.',
            data=AppUserListSerializer(app_user).data,
        )

    def delete(self, request, project_id, pk):
        project, app_user = self._get_object(project_id, pk)
        if not can_delete_own_or_admin(request, self, app_user):
            return error_response('You can only delete app users you added.', status=403)
        username = app_user.username
        app_user_id = str(app_user.id)
        app_user.delete()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.DELETED,
            module_name='AppUser',
            object_id=app_user_id,
            description=f'App user "{username}" deleted.',
        )
        return success_response('App user deleted.')


class AppUserRevealView(APIView):
    """GET /api/v1/projects/<project_id>/app-users/<pk>/reveal/"""

    permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id, pk):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        app_user = get_object_or_404(AppUser, pk=pk, project=project)
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.REVEALED,
            module_name='AppUser',
            object_id=str(app_user.id),
            description=f'App user "{app_user.username}" password/token revealed.',
        )
        return success_response(
            'App user revealed.',
            data=AppUserRevealSerializer(app_user).data,
        )
