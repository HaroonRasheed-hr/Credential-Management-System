from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.teams.models import Team, TeamMember

User = get_user_model()


class UserMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role']
        read_only_fields = fields


# ── Team serializers ──────────────────────────────────────────────────────────

class TeamMemberSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)
    added_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = TeamMember
        fields = ['id', 'user', 'role', 'added_by', 'added_at']
        read_only_fields = ['id', 'user', 'added_by', 'added_at']


class TeamListSerializer(serializers.ModelSerializer):
    created_by = UserMinimalSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ['id', 'name', 'description', 'team_type', 'member_count', 'created_by', 'created_at', 'updated_at']

    def get_member_count(self, obj) -> int:
        return obj.members.count()


class TeamDetailSerializer(serializers.ModelSerializer):
    created_by = UserMinimalSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()
    members = TeamMemberSerializer(many=True, read_only=True)

    class Meta:
        model = Team
        fields = ['id', 'name', 'description', 'team_type', 'member_count', 'members', 'created_by', 'created_at', 'updated_at']

    def get_member_count(self, obj) -> int:
        return obj.members.count()


class TeamWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ['name', 'description', 'team_type']
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'team_type': {'required': False},
        }

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


# ── Member management serializers ─────────────────────────────────────────────

class AddTeamMemberSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    role = serializers.ChoiceField(
        choices=TeamMember.Role.choices,
        default=TeamMember.Role.DEVELOPER,
    )

    def validate_user_id(self, value):
        if not User.objects.filter(pk=value).exists():
            raise serializers.ValidationError('No user found with this ID.')
        return value


class UpdateTeamMemberSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=TeamMember.Role.choices, required=False)
    email = serializers.EmailField(required=False)
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False, required=False)

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('At least one field (role, email, or password) must be provided.')
        return attrs


class CreateAndAddTeamMemberSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, trim_whitespace=True)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
    role = serializers.ChoiceField(
        choices=TeamMember.Role.choices,
        default=TeamMember.Role.DEVELOPER,
    )

    def validate_email(self, value: str) -> str:
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return normalized

    def validate_name(self, value: str) -> str:
        if User.objects.filter(username__iexact=value.strip()).exists():
            raise serializers.ValidationError('A user with this name already exists.')
        return value.strip()
