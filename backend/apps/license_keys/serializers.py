from rest_framework import serializers

from apps.license_keys.models import LicenseKey
from apps.projects.encryption import EncryptionService
from apps.projects.serializers import UserMinimalSerializer

MASKED = '••••••••'


class LicenseKeyListSerializer(serializers.ModelSerializer):
    """List view — license_key is always masked."""

    license_key = serializers.SerializerMethodField()
    updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = LicenseKey
        fields = [
            'id', 'license_name', 'license_key', 'vendor', 'expiry_date',
            'updated_by', 'created_at', 'updated_at',
        ]

    def get_license_key(self, obj) -> str:
        return MASKED


class LicenseKeyWriteSerializer(serializers.ModelSerializer):
    """Create / update — encrypts the license_key field."""

    class Meta:
        model = LicenseKey
        fields = ['license_name', 'license_key', 'vendor', 'expiry_date']
        extra_kwargs = {
            'vendor': {'required': False, 'allow_blank': True},
            'expiry_date': {'required': False, 'allow_null': True},
        }

    def create(self, validated_data):
        validated_data['license_key'] = EncryptionService.encrypt(
            validated_data['license_key']
        )
        validated_data['updated_by'] = self.context['request'].user
        validated_data['project'] = self.context['project']
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'license_key' in validated_data:
            validated_data['license_key'] = EncryptionService.encrypt(
                validated_data['license_key']
            )
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class LicenseKeyRevealSerializer(serializers.ModelSerializer):
    """Reveal endpoint — decrypts the license_key."""

    license_key = serializers.SerializerMethodField()
    updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = LicenseKey
        fields = [
            'id', 'license_name', 'license_key', 'vendor', 'expiry_date',
            'updated_by', 'created_at', 'updated_at',
        ]

    def get_license_key(self, obj) -> str:
        return EncryptionService.decrypt(obj.license_key)
