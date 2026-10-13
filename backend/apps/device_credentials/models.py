import uuid

from django.conf import settings
from django.db import models


class DeviceCredential(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device_name = models.CharField(max_length=255)
    device_ip = models.CharField(max_length=255, blank=True)
    rustdesk_ip = models.CharField(max_length=255, blank=True)
    rustdesk_password = models.TextField(blank=True)   # Fernet-encrypted
    sudo_password = models.TextField(blank=True)       # Fernet-encrypted
    device_password = models.TextField(blank=True)     # Fernet-encrypted
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='device_credentials',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'device_credentials'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.device_name


class ProjectDevice(models.Model):
    """Associates a DeviceCredential with a project (by project UUID)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_id = models.UUIDField(db_index=True)
    device = models.ForeignKey(
        DeviceCredential,
        on_delete=models.CASCADE,
        related_name='project_assignments',
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'project_device'
        unique_together = ('project_id', 'device')
        ordering = ['added_at']

    def __str__(self) -> str:
        return f'{self.device.device_name} → {self.project_id}'
