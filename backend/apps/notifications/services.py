from django.contrib.auth import get_user_model
from .models import Notification

User = get_user_model()

# Roles that receive a notification when a given role performs an action.
# Upward-visibility: actions propagate from the acting role up the hierarchy.
_NOTIFY_ROLES: dict[str, list[str]] = {
    User.Role.DEVELOPER: [User.Role.DEVELOPER, User.Role.ADMIN],
    User.Role.ADMIN:     [User.Role.ADMIN],
}


class NotificationService:

    @staticmethod
    def send(
        sender,
        action: str,
        module: str,
        title: str,
        message: str,
    ) -> list[Notification]:
        """
        Create one Notification per eligible recipient.

        Recipients are determined by the sender's role:
          DEVELOPER → DEVELOPER + ADMIN
          ADMIN     → ADMIN only

        The sender is never included as a recipient.
        """
        recipient_roles = _NOTIFY_ROLES.get(sender.role, [sender.role])

        recipients = (
            User.objects.filter(role__in=recipient_roles, is_active=True)
            .exclude(pk=sender.pk)
        )

        notifications = [
            Notification(
                recipient=recipient,
                sender=sender,
                title=title,
                message=message,
                module=module,
            )
            for recipient in recipients
        ]

        return Notification.objects.bulk_create(notifications)

    @staticmethod
    def get_unread_count(user) -> int:
        return Notification.objects.filter(recipient=user, is_read=False).count()

    @staticmethod
    def mark_all_read(user) -> None:
        Notification.objects.filter(recipient=user, is_read=False).update(is_read=True)
