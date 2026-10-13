import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Project(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        ARCHIVED = 'ARCHIVED', 'Archived'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True)
    password = models.TextField(blank=True)  # stored encrypted
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_projects',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'projects'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            while Project.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f'{base_slug}-{counter}'
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class ProjectMember(models.Model):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        DEVELOPER = 'DEVELOPER', 'Developer'

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='members',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_memberships',
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.DEVELOPER,
    )
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='added_members',
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'project_members'
        unique_together = ('project', 'user')

    def __str__(self) -> str:
        return f'{self.user} — {self.project} ({self.role})'
