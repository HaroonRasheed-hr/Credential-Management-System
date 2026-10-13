from django.core.exceptions import ValidationError
from django.db.models import Q, QuerySet

from apps.projects.models import Project, ProjectMember


class ProjectService:
    """Business-logic helpers for the projects domain."""

    @staticmethod
    def get_projects_for_user(user) -> QuerySet:
        """Return projects visible to *user*.

        - System ADMIN  → all projects.
        - DEVELOPER     → projects the user created **or** is a member of.
        """
        if user.role == 'ADMIN':
            return Project.objects.all()
        return Project.objects.filter(
            Q(created_by=user) | Q(members__user=user)
        ).distinct()

    @staticmethod
    def is_project_accessible(user, project: Project) -> bool:
        """Return True if *user* may access *project*."""
        if user.role == 'ADMIN':
            return True
        if project.created_by_id == user.pk:
            return True
        return ProjectMember.objects.filter(project=project, user=user).exists()

    @staticmethod
    def get_user_project_role(user, project: Project) -> str:
        """Return 'ADMIN' or 'DEVELOPER' representing the user's effective role
        within the project.

        Resolution order:
        1. System ADMIN → 'ADMIN'
        2. Project creator → 'ADMIN'
        3. ProjectMember.role
        4. Fallback → 'DEVELOPER'
        """
        if user.role == 'ADMIN':
            return ProjectMember.Role.ADMIN
        if project.created_by_id == user.pk:
            return ProjectMember.Role.ADMIN
        try:
            membership = ProjectMember.objects.get(project=project, user=user)
            return membership.role
        except ProjectMember.DoesNotExist:
            return ProjectMember.Role.DEVELOPER

    @staticmethod
    def add_member(project: Project, user_to_add, role: str, added_by) -> ProjectMember:
        """Add *user_to_add* to *project* with *role*.

        Raises ``ValidationError`` if:
        - the user is already a member, or
        - *added_by* tries to add themselves.
        """
        if user_to_add.pk == added_by.pk:
            raise ValidationError('You cannot add yourself as a member.')
        if ProjectMember.objects.filter(project=project, user=user_to_add).exists():
            raise ValidationError('This user is already a member of the project.')
        return ProjectMember.objects.create(
            project=project,
            user=user_to_add,
            role=role,
            added_by=added_by,
        )

    @staticmethod
    def remove_member(project: Project, user_to_remove) -> None:
        """Remove *user_to_remove* from *project*.

        Raises ``ValidationError`` if removing this member would leave the
        project with no ADMIN.
        """
        try:
            membership = ProjectMember.objects.get(project=project, user=user_to_remove)
        except ProjectMember.DoesNotExist:
            raise ValidationError('This user is not a member of the project.')

        if membership.role == ProjectMember.Role.ADMIN:
            admin_count = ProjectMember.objects.filter(
                project=project,
                role=ProjectMember.Role.ADMIN,
            ).count()
            # Also count the creator as implicit admin
            creator_is_member = (project.created_by_id == user_to_remove.pk)
            if admin_count <= 1 and not creator_is_member:
                raise ValidationError(
                    'Cannot remove the last admin from the project. '
                    'Promote another member to admin first.'
                )

        membership.delete()

    @staticmethod
    def log_activity(
        project: Project,
        user,
        action: str,
        module_name: str,
        object_id: str,
        description: str,
    ) -> None:
        """Create an ActivityLog record for *project*.

        Imported lazily to avoid circular imports between apps.
        """
        from apps.activity_log.models import ActivityLog

        ActivityLog.objects.create(
            project=project,
            user=user,
            action=action,
            module_name=module_name,
            object_id=str(object_id),
            description=description,
        )
