from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.projects.models import ProjectMember
from apps.teams.models import Team, TeamMember

from .validators import validate_password_strength, validate_username_format

User = get_user_model()


class ProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()
    joined = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    def get_full_name(self, obj) -> str:
        full = f'{obj.first_name} {obj.last_name}'.strip()
        return full or obj.username

    def get_role_display(self, obj) -> str:
        return 'Admin' if obj.role == 'ADMIN' else 'Developer'

    def get_joined(self, obj) -> str:
        return obj.created_at.strftime('%B %Y')

    def get_stats(self, obj) -> dict:
        return {
            'total_projects': ProjectMember.objects.filter(user=obj).count(),
            'team_members': TeamMember.objects.filter(team__created_by=obj).count(),
            'teams_managed': Team.objects.filter(created_by=obj).count(),
        }

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'username',
            'email', 'role', 'role_display', 'full_name',
            'joined', 'stats', 'created_at',
        ]


class UpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'username', 'email']

    def validate_username(self, value: str) -> str:
        try:
            validate_username_format(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message)
        if User.objects.filter(username=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError(
                'This username is already taken.', code='USERNAME_TAKEN'
            )
        return value

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()
        if User.objects.filter(email=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError(
                'This email is already in use.', code='EMAIL_TAKEN'
            )
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value: str) -> str:
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError(
                'Your current password is incorrect.', code='INVALID_CURRENT_PASSWORD'
            )
        return value

    def validate_new_password(self, value: str) -> str:
        try:
            validate_password_strength(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message)
        return value

    def validate(self, data: dict) -> dict:
        if data.get('new_password') != data.get('confirm_password'):
            raise serializers.ValidationError(
                {'confirm_password': 'Passwords do not match.'}
            )
        user = self.context['request'].user
        if data.get('new_password') and user.check_password(data['new_password']):
            # Raised as non_field_errors so the view can detect PASSWORD_SAME_AS_CURRENT
            raise serializers.ValidationError(
                'New password must be different from your current password.'
            )
        return data
