import uuid
from django.db import models
from django.conf import settings


class Notification(models.Model):
    MODULE_CHOICES = [
        ('ENV_VARIABLES',     'Env Variables'),
        ('LICENSE_KEYS',      'License Keys'),
        ('ADMIN_CREDENTIALS', 'Admin Credentials'),
        ('APP_USERS',         'App Users'),
        ('TEAM',              'Team'),
        ('PROJECT',           'Project'),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    sender     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_notifications',
    )
    title      = models.CharField(max_length=255)
    message    = models.TextField()
    module     = models.CharField(max_length=30, choices=MODULE_CHOICES)
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.title} → {self.recipient_id}'
