import uuid

from django.conf import settings
from django.db import models


class LicenseKey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='license_keys',
    )
    license_name = models.CharField(max_length=255)
    license_key = models.TextField()  # encrypted
    vendor = models.CharField(max_length=255, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'license_keys'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.license_name} — {self.project}'
