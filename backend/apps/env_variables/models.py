import uuid

from django.conf import settings
from django.db import models


class EnvVariable(models.Model):
    class Environment(models.TextChoices):
        DEV = 'DEV', 'Development'
        STAGING = 'STAGING', 'Staging'
        PROD = 'PROD', 'Production'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='env_variables',
    )
    key = models.CharField(max_length=255)
    value = models.TextField()  # stored encrypted
    file_name = models.CharField(max_length=255, blank=True, default='')
    file_data = models.TextField(blank=True, default='')  # base64 data URL, stored encrypted
    environment = models.CharField(
        max_length=20,
        choices=Environment.choices,
        default=Environment.DEV,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'env_variables'
        unique_together = ('project', 'key', 'environment')
        ordering = ['environment', 'key']

    def __str__(self) -> str:
        return f'{self.key} [{self.environment}] — {self.project}'
