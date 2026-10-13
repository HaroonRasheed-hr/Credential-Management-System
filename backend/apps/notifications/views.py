import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework import generics

from utils.responses import success_response, error_response, paginated_success_response
from .models import Notification
from .serializers import NotificationSerializer
from .services import NotificationService

logger = logging.getLogger(__name__)


class NotificationListView(generics.ListAPIView):
    """GET /api/v1/notifications/ — paginated list for the authenticated user."""
    permission_classes = [IsAuthenticated]
    serializer_class   = NotificationSerializer

    def get_queryset(self):
        return (
            Notification.objects
            .filter(recipient=self.request.user)
            .select_related('sender')
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page     = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return paginated_success_response(
                self.paginator, serializer.data, 'Notifications retrieved.'
            )
        serializer = self.get_serializer(queryset, many=True)
        return success_response('Notifications retrieved.', data=serializer.data)


class MarkSingleReadView(APIView):
    """PATCH /api/v1/notifications/{id}/read/ — mark a single notification as read."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return error_response('Notification not found.', status=404)

        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])

        serializer = NotificationSerializer(notification)
        return success_response('Notification marked as read.', data=serializer.data)


class MarkAllReadView(APIView):
    """POST /api/v1/notifications/mark-all-read/ — mark every notification as read."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        NotificationService.mark_all_read(request.user)
        return success_response('All notifications marked as read.')


class UnreadCountView(APIView):
    """GET /api/v1/notifications/unread-count/ — return count of unread notifications."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = NotificationService.get_unread_count(request.user)
        return success_response('Unread count retrieved.', data={'unread_count': count})
