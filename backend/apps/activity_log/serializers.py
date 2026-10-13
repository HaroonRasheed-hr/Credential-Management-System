from rest_framework import serializers

from apps.activity_log.models import ActivityLog
from apps.projects.serializers import UserMinimalSerializer


class ActivityLogSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            'id', 'user', 'project_name', 'action', 'module_name', 'object_id',
            'description', 'timestamp',
        ]
        read_only_fields = fields
