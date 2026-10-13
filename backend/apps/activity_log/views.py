import logging

from django.shortcuts import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.activity_log.models import ActivityLog
from apps.activity_log.serializers import ActivityLogSerializer
from apps.projects.models import Project
from apps.projects.permissions import IsProjectMember
from apps.projects.services import ProjectService
from utils.responses import error_response, success_response

logger = logging.getLogger(__name__)


class ActivityLogListView(APIView):
    """
    GET /api/v1/projects/<project_id>/activity-log/

    Read-only, paginated (10 per page), ordered by -timestamp.
    Accessible to all project members.
    """

    permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id):
        project = get_object_or_404(Project, pk=project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)

        logs = ActivityLog.objects.filter(project=project).select_related('user')

        # Optional filter by action
        action = request.query_params.get('action')
        if action:
            logs = logs.filter(action=action.upper())

        # Optional filter by module
        module = request.query_params.get('module')
        if module:
            logs = logs.filter(module_name__iexact=module)

        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(logs, request)
        if page is not None:
            serializer = ActivityLogSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = ActivityLogSerializer(logs, many=True)
        return success_response('Activity log retrieved.', data=serializer.data)
