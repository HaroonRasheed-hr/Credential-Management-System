import uuid

from django.conf import settings
from django.db import models


class AdminCredential(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='admin_credentials',
    )
    admin_panel_url = models.URLField(max_length=500)
    username = models.CharField(max_length=255)
    password = models.TextField()  # encrypted
    notes = models.TextField(blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'admin_credentials'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.username} @ {self.admin_panel_url}'
