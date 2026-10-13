from rest_framework import serializers

from apps.environment_credentials.models import EnvironmentCredential
from apps.projects.encryption import EncryptionService
from apps.projects.serializers import UserMinimalSerializer

MASKED = '••••••••'


class EnvironmentCredentialListSerializer(serializers.ModelSerializer):
    """List view — passwords are always masked."""

    admin_password = serializers.SerializerMethodField()
    rustdesk_password = serializers.SerializerMethodField()
    updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = EnvironmentCredential
        fields = [
            'id', 'environment_type', 'system_name', 'system_ip', 'admin_password',
            'rustdesk_ip', 'rustdesk_password', 'updated_by', 'created_at', 'updated_at',
        ]

    def get_admin_password(self, obj) -> str:
        return MASKED if obj.admin_password else ''

    def get_rustdesk_password(self, obj) -> str:
        return MASKED if obj.rustdesk_password else ''


class EnvironmentCredentialWriteSerializer(serializers.ModelSerializer):
    """Create / update — encrypts password fields."""

    class Meta:
        model = EnvironmentCredential
        fields = [
            'system_name', 'system_ip', 'admin_password',
            'rustdesk_ip', 'rustdesk_password',
        ]
        extra_kwargs = {
            'system_name': {'required': False, 'allow_blank': True},
            'system_ip': {'required': False, 'allow_blank': True},
            'admin_password': {'required': False, 'allow_blank': True},
            'rustdesk_ip': {'required': False, 'allow_blank': True},
            'rustdesk_password': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        # Encrypt passwords if provided
        if validated_data.get('admin_password'):
            validated_data['admin_password'] = EncryptionService.encrypt(validated_data['admin_password'])
        if validated_data.get('rustdesk_password'):
            validated_data['rustdesk_password'] = EncryptionService.encrypt(validated_data['rustdesk_password'])
        
        validated_data['updated_by'] = self.context['request'].user
        validated_data['project'] = self.context['project']
        validated_data['environment_type'] = self.context['environment_type']
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Encrypt passwords only if they are being updated
        if 'admin_password' in validated_data and validated_data['admin_password']:
            validated_data['admin_password'] = EncryptionService.encrypt(validated_data['admin_password'])
        if 'rustdesk_password' in validated_data and validated_data['rustdesk_password']:
            validated_data['rustdesk_password'] = EncryptionService.encrypt(validated_data['rustdesk_password'])
        
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class EnvironmentCredentialRevealSerializer(serializers.ModelSerializer):
    """Reveal endpoint — decrypts passwords."""

    admin_password = serializers.SerializerMethodField()
    rustdesk_password = serializers.SerializerMethodField()
    updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = EnvironmentCredential
        fields = [
            'id', 'environment_type', 'system_name', 'system_ip', 'admin_password',
            'rustdesk_ip', 'rustdesk_password', 'updated_by', 'created_at', 'updated_at',
        ]

    def get_admin_password(self, obj) -> str:
        return EncryptionService.decrypt(obj.admin_password) if obj.admin_password else ''

    def get_rustdesk_password(self, obj) -> str:
        return EncryptionService.decrypt(obj.rustdesk_password) if obj.rustdesk_password else ''
