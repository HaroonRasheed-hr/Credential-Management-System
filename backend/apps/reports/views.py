import logging
import uuid
from datetime import date

from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.activity_log.models import ActivityLog
from apps.projects.services import ProjectService
from apps.reports.services import generate_activity_report_pdf, _user_display
from utils.responses import error_response, success_response

logger = logging.getLogger(__name__)


class RecentActivityView(APIView):
    """
    GET /api/v1/reports/recent-activity/?limit=20

    Returns the most recent activity log entries across all projects visible
    to the requesting user. Admins see everything; developers see only
    their accessible projects.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            limit = min(int(request.query_params.get('limit', 20)), 50)
        except ValueError:
            limit = 20

        qs = (
            ActivityLog.objects
            .select_related('project', 'user')
            .order_by('-timestamp')
        )

        if not request.user.is_admin:
            visible = ProjectService.get_projects_for_user(request.user)
            qs = qs.filter(project__in=visible)

        data = []
        for log in qs[:limit]:
            user_info = None
            if log.user:
                user_info = {
                    'id': str(log.user_id),
                    'username': log.user.username,
                    'role': log.user.role,
                }
            if log.project:
                project_info = {
                    'id': str(log.project_id),
                    'name': log.project.name,
                }
            else:
                # Project was deleted (FK is SET_NULL); fall back to the
                # denormalized name stored on the log.
                project_info = {
                    'id': None,
                    'name': log.project_name or 'Unknown Project',
                }
            data.append({
                'id': str(log.id),
                'project': project_info,
                'user': user_info,
                'action': log.action,
                'module_name': log.module_name,
                'description': log.description,
                'timestamp': log.timestamp.isoformat(),
            })

        return success_response('Recent activities retrieved.', data=data)


class ActivityReportView(APIView):
    """
    GET /api/v1/reports/activity/?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD
        [&project_id=<uuid>]

    Generates and streams a PDF activity report covering all projects visible
    to the requesting user within the specified date range. When an optional
    ``project_id`` is supplied, the report is scoped to that single project.
    Admin-only endpoint.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_admin:
            return error_response('Only admins can generate reports.', status=403)

        from_date_str = request.query_params.get('from_date', '').strip()
        to_date_str = request.query_params.get('to_date', '').strip()

        if not from_date_str or not to_date_str:
            return error_response('Both from_date and to_date are required (YYYY-MM-DD).', status=400)

        try:
            from_date = date.fromisoformat(from_date_str)
            to_date = date.fromisoformat(to_date_str)
        except ValueError:
            return error_response('Invalid date format. Use YYYY-MM-DD.', status=400)

        if from_date > to_date:
            return error_response('from_date must be on or before to_date.', status=400)

        if (to_date - from_date).days > 365:
            return error_response('Date range cannot exceed 365 days.', status=400)

        # Optional single-project scope. When omitted (or blank) the report
        # covers every project, preserving the original behaviour.
        project_id_str = request.query_params.get('project_id', '').strip()
        project_id = None
        if project_id_str:
            try:
                project_id = uuid.UUID(project_id_str)
            except ValueError:
                return error_response('Invalid project_id.', status=400)

        logs_qs = (
            ActivityLog.objects
            .filter(timestamp__date__gte=from_date, timestamp__date__lte=to_date)
            .select_related('project', 'user')
            .order_by('project__name', 'timestamp')
        )

        if project_id is not None:
            logs_qs = logs_qs.filter(project_id=project_id)

        projects_seen: dict = {}
        projects_order: list = []
        for log in logs_qs:
            pid = str(log.project_id)
            if pid not in projects_seen:
                projects_seen[pid] = {'project': log.project, 'activities': []}
                projects_order.append(pid)
            projects_seen[pid]['activities'].append(log)

        activities_by_project = [projects_seen[pid] for pid in projects_order]

        total_activities = sum(len(e['activities']) for e in activities_by_project)
        unique_user_ids = {
            log.user_id
            for e in activities_by_project
            for log in e['activities']
            if log.user_id
        }

        generated_by = _user_display(request.user)

        try:
            pdf_bytes = generate_activity_report_pdf(
                activities_by_project=activities_by_project,
                from_date=from_date,
                to_date=to_date,
                generated_by=generated_by,
                total_activities=total_activities,
                unique_users=len(unique_user_ids),
            )
        except Exception:
            logger.exception('Failed to generate activity report PDF')
            return error_response('Failed to generate PDF. Please try again.', status=500)

        if project_id is not None:
            # Derive a filesystem-safe project slug for the filename when the
            # report is scoped to a single project.
            project_name = next(
                (e['project'].name for e in activities_by_project if e['project']),
                None,
            )
            if not project_name:
                project_name = next(
                    (
                        log.project_name
                        for e in activities_by_project
                        for log in e['activities']
                        if getattr(log, 'project_name', '')
                    ),
                    'project',
                )
            safe_name = ''.join(
                c if c.isalnum() else '_' for c in (project_name or 'project')
            ).strip('_').lower() or 'project'
            filename = (
                f'xisai_activity_report_{safe_name}_{from_date_str}_to_{to_date_str}.pdf'
            )
        else:
            filename = f'xisai_activity_report_{from_date_str}_to_{to_date_str}.pdf'
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Content-Length'] = len(pdf_bytes)
        return response
