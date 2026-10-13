from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.projects.encryption import EncryptionService
from apps.projects.models import Project, ProjectMember

User = get_user_model()

MASKED = '••••••••'


class UserMinimalSerializer(serializers.ModelSerializer):
    """Compact user representation used as nested read-only field."""

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'role']
        read_only_fields = fields


# ── Project serializers ───────────────────────────────────────────────────────

class ProjectListSerializer(serializers.ModelSerializer):
    """Used in list responses — password masked, counts included.

    The five counts are read directly from queryset annotations
    (see ``ProjectListCreateView.get_queryset``) rather than issuing a
    ``.count()`` per project, which avoids an N+1 query pattern.
    """

    password = serializers.SerializerMethodField()
    created_by = UserMinimalSerializer(read_only=True)
    member_count = serializers.IntegerField(read_only=True)
    env_count = serializers.IntegerField(read_only=True)
    license_count = serializers.IntegerField(read_only=True)
    admin_cred_count = serializers.IntegerField(read_only=True)
    app_user_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'slug', 'description', 'password',
            'status', 'created_by', 'created_at', 'updated_at',
            'member_count', 'env_count', 'license_count',
            'admin_cred_count', 'app_user_count',
        ]

    def get_password(self, obj) -> str:
        return MASKED if obj.password else ''


class ProjectDetailSerializer(serializers.ModelSerializer):
    """Used for retrieve responses — password masked, counts included."""

    password = serializers.SerializerMethodField()
    created_by = UserMinimalSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()
    env_count = serializers.SerializerMethodField()
    license_count = serializers.SerializerMethodField()
    admin_cred_count = serializers.SerializerMethodField()
    app_user_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'slug', 'description', 'password',
            'status', 'created_by', 'created_at', 'updated_at',
            'member_count', 'env_count', 'license_count',
            'admin_cred_count', 'app_user_count',
        ]

    def get_password(self, obj) -> str:
        return MASKED if obj.password else ''

    def get_member_count(self, obj) -> int:
        return obj.members.count()

    def get_env_count(self, obj) -> int:
        return obj.env_variables.count()

    def get_license_count(self, obj) -> int:
        return obj.license_keys.count()

    def get_admin_cred_count(self, obj) -> int:
        return obj.admin_credentials.count()

    def get_app_user_count(self, obj) -> int:
        return obj.app_users.count()


class ProjectWriteSerializer(serializers.ModelSerializer):
    """Used for create/update — encrypts password if provided."""

    class Meta:
        model = Project
        fields = ['name', 'description', 'password', 'status']
        extra_kwargs = {
            'password': {'required': False, 'allow_blank': True},
            'status': {'required': False},
        }

    def create(self, validated_data):
        if 'password' in validated_data and validated_data['password']:
            validated_data['password'] = EncryptionService.encrypt(
                validated_data['password']
            )
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'password' in validated_data and validated_data['password']:
            validated_data['password'] = EncryptionService.encrypt(
                validated_data['password']
            )
        return super().update(instance, validated_data)


class ProjectRevealSerializer(serializers.ModelSerializer):
    """Returns the decrypted project password."""

    password = serializers.SerializerMethodField()
    created_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'slug', 'description', 'password',
            'status', 'created_by', 'created_at', 'updated_at',
        ]

    def get_password(self, obj) -> str:
        return EncryptionService.decrypt(obj.password) if obj.password else ''


# ── ProjectMember serializers ─────────────────────────────────────────────────

class ProjectMemberSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)
    added_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = ProjectMember
        fields = ['id', 'user', 'role', 'added_by', 'added_at']
        read_only_fields = ['id', 'user', 'added_by', 'added_at']


class AddMemberSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    role = serializers.ChoiceField(
        choices=ProjectMember.Role.choices,
        default=ProjectMember.Role.DEVELOPER,
    )

    def validate_user_id(self, value):
        try:
            User.objects.get(pk=value)
        except User.DoesNotExist:
            raise serializers.ValidationError('No user found with this ID.')
        return value
