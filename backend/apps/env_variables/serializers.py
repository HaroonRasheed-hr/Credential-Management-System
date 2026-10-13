from rest_framework import serializers

from apps.env_variables.models import EnvVariable
from apps.projects.encryption import EncryptionService
from apps.projects.serializers import UserMinimalSerializer

MASKED = '••••••••'


class EnvVariableListSerializer(serializers.ModelSerializer):
    """List view — value is always masked; attached file is returned for download."""

    value = serializers.SerializerMethodField()
    file_data = serializers.SerializerMethodField()
    updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = EnvVariable
        fields = [
            'id', 'key', 'value', 'environment', 'file_name', 'file_data',
            'updated_by', 'created_at', 'updated_at',
        ]

    def get_value(self, obj) -> str:
        return MASKED

    def get_file_data(self, obj) -> str:
        return EncryptionService.decrypt(obj.file_data) if obj.file_data else ''


class EnvVariableWriteSerializer(serializers.ModelSerializer):
    """Create / update — encrypts the value, auto-sets updated_by."""

    class Meta:
        model = EnvVariable
        fields = ['key', 'value', 'environment', 'file_name', 'file_data']

    def validate_key(self, value: str) -> str:
        # Accept any non-empty name as typed (e.g. ``.env``, ``.env.local``,
        # ``env.local``). Names are stored verbatim — no case-folding or
        # character restrictions.
        key = value.strip()
        if not key:
            raise serializers.ValidationError('This field is required.')
        return key

    def validate(self, attrs):
        # Guard the (project, key, environment) uniqueness here so a duplicate
        # returns a friendly 400 instead of crashing on the DB constraint (500).
        # ``project`` is not a serializer field, so DRF cannot build the
        # UniqueTogetherValidator automatically.
        project = self.context.get('project') or getattr(self.instance, 'project', None)
        key = attrs.get('key', getattr(self.instance, 'key', None))
        environment = attrs.get(
            'environment',
            getattr(self.instance, 'environment', EnvVariable.Environment.DEV),
        )
        if project and key:
            duplicates = EnvVariable.objects.filter(
                project=project, key=key, environment=environment,
            )
            if self.instance is not None:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError(
                    {'key': 'You already uploaded this file. A variable with this '
                            'name already exists for this environment.'}
                )
        return attrs

    def create(self, validated_data):
        validated_data['value'] = EncryptionService.encrypt(validated_data['value'])
        if validated_data.get('file_data'):
            validated_data['file_data'] = EncryptionService.encrypt(validated_data['file_data'])
        validated_data['updated_by'] = self.context['request'].user
        validated_data['project'] = self.context['project']
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'value' in validated_data:
            validated_data['value'] = EncryptionService.encrypt(validated_data['value'])
        if 'file_data' in validated_data:
            # Empty string clears the attachment; non-empty is encrypted at rest.
            validated_data['file_data'] = (
                EncryptionService.encrypt(validated_data['file_data'])
                if validated_data['file_data'] else ''
            )
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class EnvVariableRevealSerializer(serializers.ModelSerializer):
    """Reveal endpoint — decrypts the value."""

    value = serializers.SerializerMethodField()
    file_data = serializers.SerializerMethodField()
    updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = EnvVariable
        fields = [
            'id', 'key', 'value', 'environment', 'file_name', 'file_data',
            'updated_by', 'created_at', 'updated_at',
        ]

    def get_value(self, obj) -> str:
        return EncryptionService.decrypt(obj.value)

    def get_file_data(self, obj) -> str:
        return EncryptionService.decrypt(obj.file_data) if obj.file_data else ''
