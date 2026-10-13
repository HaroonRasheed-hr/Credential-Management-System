from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allows access only to users with the ADMIN role."""

    message = 'Admin role required.'

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'ADMIN'
        )


class IsDeveloper(BasePermission):
    """Allows access only to users with the DEVELOPER role."""

    message = 'Developer role required.'

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'DEVELOPER'
        )


class IsAdminOrDeveloper(BasePermission):
    """Allows access to both ADMIN and DEVELOPER roles."""

    message = 'Admin or Developer role required.'

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ('ADMIN', 'DEVELOPER')
        )
