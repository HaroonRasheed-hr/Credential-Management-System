import uuid

from django.conf import settings
from django.db import models


class Team(models.Model):
    class TeamType(models.TextChoices):
        AI_RESEARCH = 'AI_RESEARCH', 'AI / Research'
        ENGINEERING = 'ENGINEERING', 'Engineering'
        ADMIN = 'ADMIN', 'Admin'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    team_type = models.CharField(
        max_length=20,
        choices=TeamType.choices,
        default=TeamType.AI_RESEARCH,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_teams',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'teams'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.name


class TeamMember(models.Model):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        DEVELOPER = 'DEVELOPER', 'Developer'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='members',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='team_memberships',
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.DEVELOPER,
    )
    password_plaintext = models.TextField(blank=True, default='')
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='added_team_members',
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'team_members'
        unique_together = ('team', 'user')

    def __str__(self) -> str:
        return f'{self.user} — {self.team} ({self.role})'
