import logging

from django.shortcuts import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.device_credentials.models import DeviceCredential, ProjectDevice
from apps.device_credentials.permissions import IsAdminRole
from apps.device_credentials.serializers import (
    DeviceCredentialListSerializer,
    DeviceCredentialRevealSerializer,
    DeviceCredentialWriteSerializer,
    ProjectDeviceSerializer,
)
from utils.responses import error_response, paginated_success_response, success_response

logger = logging.getLogger(__name__)


class DeviceCredentialListCreateView(APIView):
    """
    GET  /api/v1/devices/  — any authenticated user (Admin + Developer)
    POST /api/v1/devices/  — Admin only
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        devices = DeviceCredential.objects.select_related('created_by').all()
        paginator = PageNumberPagination()
        paginator.page_size = 100
        page = paginator.paginate_queryset(devices, request)
        if page is not None:
            serializer = DeviceCredentialListSerializer(page, many=True)
            return paginated_success_response(paginator, serializer.data, 'Device credentials retrieved.')
        serializer = DeviceCredentialListSerializer(devices, many=True)
        return success_response('Device credentials retrieved.', data=serializer.data)

    def post(self, request):
        if not IsAdminRole().has_permission(request, self):
            return error_response('Only administrators can create device credentials.', status=403)
        serializer = DeviceCredentialWriteSerializer(
            data=request.data,
            context={'request': request},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        device = serializer.save()
        logger.info('DeviceCredential created: %s by %s', device.id, request.user.email)
        return success_response(
            'Device credential created.',
            data=DeviceCredentialListSerializer(device).data,
            status=201,
        )


class DeviceCredentialDetailView(APIView):
    """
    PATCH  /api/v1/devices/<pk>/
    DELETE /api/v1/devices/<pk>/
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def _get_device(self, pk) -> DeviceCredential:
        return get_object_or_404(DeviceCredential, pk=pk)

    def patch(self, request, pk):
        device = self._get_device(pk)
        serializer = DeviceCredentialWriteSerializer(
            device,
            data=request.data,
            partial=True,
            context={'request': request},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        device = serializer.save()
        logger.info('DeviceCredential updated: %s by %s', device.id, request.user.email)
        return success_response(
            'Device credential updated.',
            data=DeviceCredentialListSerializer(device).data,
        )

    def delete(self, request, pk):
        device = self._get_device(pk)
        device_id = str(device.id)
        name = device.device_name
        device.delete()
        logger.info('DeviceCredential deleted: %s (%s) by %s', device_id, name, request.user.email)
        return success_response('Device credential deleted.')


class DeviceCredentialRevealView(APIView):
    """
    GET /api/v1/devices/<pk>/reveal/

    Returns the record with all three password fields decrypted.
    Any authenticated user (Admin + Developer) can reveal.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        device = get_object_or_404(DeviceCredential, pk=pk)
        logger.info('DeviceCredential revealed: %s by %s', device.id, request.user.email)
        return success_response(
            'Device credential revealed.',
            data=DeviceCredentialRevealSerializer(device).data,
        )


class ProjectDeviceListCreateView(APIView):
    """
    GET  /api/v1/devices/projects/<project_id>/  — any authenticated user
    POST /api/v1/devices/projects/<project_id>/  — Admin only, body: { device_id }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        assignments = (
            ProjectDevice.objects
            .select_related('device')
            .filter(project_id=project_id)
        )
        serializer = ProjectDeviceSerializer(assignments, many=True)
        return success_response('Project devices retrieved.', data=serializer.data)

    def post(self, request, project_id):
        if not IsAdminRole().has_permission(request, self):
            return error_response('Only administrators can add devices to projects.', status=403)

        device_id = request.data.get('device_id')
        if not device_id:
            return error_response('device_id is required.', status=400)

        device = get_object_or_404(DeviceCredential, pk=device_id)

        if ProjectDevice.objects.filter(project_id=project_id, device=device).exists():
            return error_response('Device is already added to this project.', status=400)

        assignment = ProjectDevice.objects.create(project_id=project_id, device=device)
        logger.info('ProjectDevice added: %s → project %s by %s', device.id, project_id, request.user.email)
        return success_response(
            'Device added to project.',
            data=ProjectDeviceSerializer(assignment).data,
            status=201,
        )


class ProjectDeviceDeleteView(APIView):
    """
    DELETE /api/v1/devices/projects/<project_id>/<device_id>/  — Admin only
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def delete(self, request, project_id, device_id):
        assignment = get_object_or_404(ProjectDevice, project_id=project_id, device_id=device_id)
        assignment.delete()
        logger.info('ProjectDevice removed: device %s from project %s by %s', device_id, project_id, request.user.email)
        return success_response('Device removed from project.')
