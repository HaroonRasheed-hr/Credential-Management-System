import uuid

from django.conf import settings
from django.db import models


class ActivityLog(models.Model):
    class Action(models.TextChoices):
        CREATED = 'CREATED', 'Created'
        ADDED = 'ADDED', 'Added'
        UPDATED = 'UPDATED', 'Updated'
        DELETED = 'DELETED', 'Deleted'
        REVEALED = 'REVEALED', 'Revealed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs',
    )
    # Denormalized copy of the project name so the log remains meaningful
    # after its project is deleted (the FK above is nulled, not cascaded).
    project_name = models.CharField(max_length=255, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    module_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100, blank=True)
    description = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'activity_logs'
        ordering = ['-timestamp']

    def save(self, *args, **kwargs):
        # Capture the project name at write time so it survives the project
        # being deleted later on.
        if self.project_id and not self.project_name:
            self.project_name = self.project.name
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f'[{self.action}] {self.module_name} by {self.user} at {self.timestamp}'
