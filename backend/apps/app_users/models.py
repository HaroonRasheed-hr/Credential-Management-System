import uuid

from django.conf import settings
from django.db import models


class AppUser(models.Model):
    class RoleInApp(models.TextChoices):
        SUPERADMIN = 'SUPERADMIN', 'Super Admin'
        ADMIN = 'ADMIN', 'Admin'
        SUPERUSER = 'SUPERUSER', 'Super User'
        STAFF = 'STAFF', 'Staff'
        CUSTOMER = 'CUSTOMER', 'Customer'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='app_users',
    )
    username = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    password_or_token = models.TextField()  # encrypted
    role_in_app = models.CharField(
        max_length=100,
        default=RoleInApp.CUSTOMER,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'app_users'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.username} ({self.role_in_app}) — {self.project}'
