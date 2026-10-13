from rest_framework.permissions import BasePermission

from apps.projects.models import Project, ProjectMember


def _get_project(view) -> Project | None:
    """Resolve the Project instance from the view's URL kwargs."""
    project_id = view.kwargs.get('project_id')
    if not project_id:
        return None
    try:
        return Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return None


def _is_system_admin(user) -> bool:
    return user.role == 'ADMIN'


def _get_membership(user, project) -> ProjectMember | None:
    try:
        return ProjectMember.objects.get(project=project, user=user)
    except ProjectMember.DoesNotExist:
        return None


class IsProjectMember(BasePermission):
    """Allow access when the request user is:
    - a system ADMIN, OR
    - the project creator, OR
    - a ProjectMember of the project.
    """

    message = 'You are not a member of this project.'

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if _is_system_admin(request.user):
            return True
        project = _get_project(view)
        if project is None:
            return False
        if project.created_by_id == request.user.pk:
            return True
        return ProjectMember.objects.filter(
            project=project, user=request.user
        ).exists()


class IsProjectAdmin(BasePermission):
    """Allow access when the request user is:
    - a system ADMIN, OR
    - the project creator, OR
    - a ProjectMember with role ADMIN.
    """

    message = 'You must be a project admin to perform this action.'

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if _is_system_admin(request.user):
            return True
        project = _get_project(view)
        if project is None:
            return False
        if project.created_by_id == request.user.pk:
            return True
        membership = _get_membership(request.user, project)
        return membership is not None and membership.role == ProjectMember.Role.ADMIN


class CanDeleteProjectRecord(BasePermission):
    """Allow DELETE only for system ADMIN or project-level ADMIN."""

    message = 'Only admins can delete records.'

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if _is_system_admin(request.user):
            return True
        project = _get_project(view)
        if project is None:
            return False
        if project.created_by_id == request.user.pk:
            return True
        membership = _get_membership(request.user, project)
        return membership is not None and membership.role == ProjectMember.Role.ADMIN


def can_delete_own_or_admin(request, view, obj) -> bool:
    """Allow DELETE if the user is an admin OR is the one who last updated the record.

    Admins (system-level, project creator, project-level ADMIN) can delete any record.
    Developers can delete only records where updated_by matches their account.
    """
    if not request.user or not request.user.is_authenticated:
        return False
    if _is_system_admin(request.user):
        return True
    project = _get_project(view)
    if project is None:
        return False
    if project.created_by_id == request.user.pk:
        return True
    membership = _get_membership(request.user, project)
    if membership is not None and membership.role == ProjectMember.Role.ADMIN:
        return True
    updated_by = getattr(obj, 'updated_by', None)
    if updated_by is not None and updated_by.pk == request.user.pk:
        return True
    return False
