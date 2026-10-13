from rest_framework import serializers

from apps.admin_credentials.models import AdminCredential
from apps.projects.encryption import EncryptionService
from apps.projects.serializers import UserMinimalSerializer
from apps.projects.validators import validate_url

MASKED = '••••••••'


class AdminCredentialListSerializer(serializers.ModelSerializer):
    """List view — password is always masked."""

    password = serializers.SerializerMethodField()
    updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = AdminCredential
        fields = [
            'id', 'admin_panel_url', 'username', 'password', 'notes',
            'updated_by', 'created_at', 'updated_at',
        ]

    def get_password(self, obj) -> str:
        return MASKED


class AdminCredentialWriteSerializer(serializers.ModelSerializer):
    """Create / update — encrypts the password field."""

    class Meta:
        model = AdminCredential
        fields = ['admin_panel_url', 'username', 'password', 'notes']
        extra_kwargs = {
            'notes': {'required': False, 'allow_blank': True},
        }

    def validate_admin_panel_url(self, value: str) -> str:
        validate_url(value)
        return value

    def create(self, validated_data):
        validated_data['password'] = EncryptionService.encrypt(validated_data['password'])
        validated_data['updated_by'] = self.context['request'].user
        validated_data['project'] = self.context['project']
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'password' in validated_data:
            validated_data['password'] = EncryptionService.encrypt(validated_data['password'])
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class AdminCredentialRevealSerializer(serializers.ModelSerializer):
    """Reveal endpoint — decrypts the password."""

    password = serializers.SerializerMethodField()
    updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = AdminCredential
        fields = [
            'id', 'admin_panel_url', 'username', 'password', 'notes',
            'updated_by', 'created_at', 'updated_at',
        ]

    def get_password(self, obj) -> str:
        return EncryptionService.decrypt(obj.password)
