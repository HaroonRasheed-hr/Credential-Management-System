from rest_framework import serializers

from apps.device_credentials.models import DeviceCredential, ProjectDevice
from apps.projects.encryption import EncryptionService
from apps.projects.serializers import UserMinimalSerializer

MASKED = '••••••••'

_ENCRYPTED_FIELDS = ('rustdesk_password', 'sudo_password', 'device_password')


def _encrypt_if_present(validated_data: dict) -> dict:
    """Encrypt every password field that is present and non-empty."""
    for field in _ENCRYPTED_FIELDS:
        value = validated_data.get(field)
        if value:
            validated_data[field] = EncryptionService.encrypt(value)
    return validated_data


class DeviceCredentialListSerializer(serializers.ModelSerializer):
    """Used for list / create / update responses — passwords always masked."""

    rustdesk_password = serializers.SerializerMethodField()
    sudo_password = serializers.SerializerMethodField()
    device_password = serializers.SerializerMethodField()
    created_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = DeviceCredential
        fields = [
            'id',
            'device_name',
            'device_ip',
            'rustdesk_ip',
            'rustdesk_password',
            'sudo_password',
            'device_password',
            'created_by',
            'created_at',
            'updated_at',
        ]

    def get_rustdesk_password(self, obj) -> str:
        return MASKED if obj.rustdesk_password else ''

    def get_sudo_password(self, obj) -> str:
        return MASKED if obj.sudo_password else ''

    def get_device_password(self, obj) -> str:
        return MASKED if obj.device_password else ''


class DeviceCredentialWriteSerializer(serializers.ModelSerializer):
    """Used for create / update requests — encrypts password fields."""

    class Meta:
        model = DeviceCredential
        fields = [
            'device_name',
            'device_ip',
            'rustdesk_ip',
            'rustdesk_password',
            'sudo_password',
            'device_password',
        ]
        extra_kwargs = {
            'device_ip': {'required': False, 'allow_blank': True},
            'rustdesk_ip': {'required': False, 'allow_blank': True},
            'rustdesk_password': {'required': False, 'allow_blank': True},
            'sudo_password': {'required': False, 'allow_blank': True},
            'device_password': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        _encrypt_if_present(validated_data)
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        _encrypt_if_present(validated_data)
        return super().update(instance, validated_data)


class DeviceCredentialRevealSerializer(serializers.ModelSerializer):
    """Used by the reveal endpoint — decrypts all three password fields."""

    rustdesk_password = serializers.SerializerMethodField()
    sudo_password = serializers.SerializerMethodField()
    device_password = serializers.SerializerMethodField()
    created_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = DeviceCredential
        fields = [
            'id',
            'device_name',
            'device_ip',
            'rustdesk_ip',
            'rustdesk_password',
            'sudo_password',
            'device_password',
            'created_by',
            'created_at',
            'updated_at',
        ]

    def get_rustdesk_password(self, obj) -> str:
        return EncryptionService.decrypt(obj.rustdesk_password) if obj.rustdesk_password else ''

    def get_sudo_password(self, obj) -> str:
        return EncryptionService.decrypt(obj.sudo_password) if obj.sudo_password else ''

    def get_device_password(self, obj) -> str:
        return EncryptionService.decrypt(obj.device_password) if obj.device_password else ''


class ProjectDeviceSerializer(serializers.ModelSerializer):
    """Flat serializer for ProjectDevice — exposes the linked device fields directly."""

    device_id = serializers.UUIDField(source='device.id', read_only=True)
    device_name = serializers.CharField(source='device.device_name', read_only=True)
    device_ip = serializers.CharField(source='device.device_ip', read_only=True)

    class Meta:
        model = ProjectDevice
        fields = ['id', 'device_id', 'device_name', 'device_ip', 'added_at']
