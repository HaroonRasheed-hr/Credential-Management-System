from rest_framework import serializers
from .models import Notification


class SenderSerializer(serializers.Serializer):
    name     = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()

    def get_name(self, obj) -> str:
        return f'{obj.first_name} {obj.last_name}'.strip() or obj.username

    def get_initials(self, obj) -> str:
        first = (obj.first_name or '').strip()
        last  = (obj.last_name  or '').strip()
        if first and last:
            return f'{first[0]}{last[0]}'.upper()
        if first:
            return first[:2].upper()
        return (obj.username or '')[:2].upper()


class NotificationSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()

    class Meta:
        model  = Notification
        fields = ['id', 'title', 'message', 'module', 'is_read', 'sender', 'created_at']
        read_only_fields = fields

    def get_sender(self, obj) -> dict | None:
        if obj.sender is None:
            return None
        return SenderSerializer(obj.sender).data
