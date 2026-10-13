import uuid

from django.conf import settings
from django.db import models


class EnvironmentCredential(models.Model):
    """
    Stores system and RustDesk credentials for Development and Deployment environments.
    """

    class EnvironmentType(models.TextChoices):
        DEVELOPMENT = 'DEVELOPMENT', 'Development'
        DEPLOYMENT = 'DEPLOYMENT', 'Deployment'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='environment_credentials',
    )
    environment_type = models.CharField(
        max_length=20,
        choices=EnvironmentType.choices,
    )
    
    # System credentials
    system_name = models.CharField(max_length=255, blank=True)
    system_ip = models.CharField(max_length=255, blank=True)
    admin_password = models.TextField(blank=True)  # encrypted
    
    # RustDesk credentials
    rustdesk_ip = models.CharField(max_length=255, blank=True)
    rustdesk_password = models.TextField(blank=True)  # encrypted
    
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'environment_credentials'
        ordering = ['environment_type']
        unique_together = ('project', 'environment_type')

    def __str__(self) -> str:
        return f'{self.environment_type} - {self.system_name or "Unnamed"}'
