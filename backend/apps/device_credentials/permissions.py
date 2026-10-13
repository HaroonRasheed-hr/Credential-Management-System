from rest_framework.permissions import BasePermission

from apps.users.models import User


class IsAdminRole(BasePermission):
    """Allow access only to users with the ADMIN role."""

    message = 'Only administrators can access device credentials.'

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.ADMIN
        )
