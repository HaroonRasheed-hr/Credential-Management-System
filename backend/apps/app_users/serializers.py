from rest_framework import serializers

from apps.app_users.models import AppUser
from apps.projects.encryption import EncryptionService
from apps.projects.serializers import UserMinimalSerializer

MASKED = '••••••••'


class AppUserListSerializer(serializers.ModelSerializer):
    """List view — password_or_token is always masked."""

    password_or_token = serializers.SerializerMethodField()
    updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = AppUser
        fields = [
            'id', 'username', 'email', 'password_or_token', 'role_in_app',
            'updated_by', 'created_at', 'updated_at',
        ]

    def get_password_or_token(self, obj) -> str:
        return MASKED


class AppUserWriteSerializer(serializers.ModelSerializer):
    """Create / update — encrypts password_or_token."""

    class Meta:
        model = AppUser
        fields = ['username', 'email', 'password_or_token', 'role_in_app']
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True},
            'role_in_app': {'required': False},
        }

    def create(self, validated_data):
        validated_data['password_or_token'] = EncryptionService.encrypt(
            validated_data['password_or_token']
        )
        validated_data['updated_by'] = self.context['request'].user
        validated_data['project'] = self.context['project']
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'password_or_token' in validated_data:
            validated_data['password_or_token'] = EncryptionService.encrypt(
                validated_data['password_or_token']
            )
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class AppUserRevealSerializer(serializers.ModelSerializer):
    """Reveal endpoint — decrypts password_or_token."""

    password_or_token = serializers.SerializerMethodField()
    updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = AppUser
        fields = [
            'id', 'username', 'email', 'password_or_token', 'role_in_app',
            'updated_by', 'created_at', 'updated_at',
        ]

    def get_password_or_token(self, obj) -> str:
        return EncryptionService.decrypt(obj.password_or_token)
