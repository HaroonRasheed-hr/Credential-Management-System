import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        DEVELOPER = 'DEVELOPER', 'Developer'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    username = models.CharField(max_length=150, unique=True)
    first_name = models.CharField(max_length=150, blank=True, default='')
    last_name = models.CharField(max_length=150, blank=True, default='')
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.DEVELOPER)

    # Lockout tracking
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    lockout_until = models.DateTimeField(null=True, blank=True, db_index=True)

    # Login metadata
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.email

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_developer(self) -> bool:
        return self.role == self.Role.DEVELOPER
