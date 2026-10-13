from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'username', 'role', 'is_active', 'failed_login_attempts', 'lockout_until', 'created_at')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('email', 'username')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'last_login_at', 'last_login_ip', 'last_login')

    fieldsets = (
        (None, {'fields': ('id', 'email', 'username', 'password')}),
        ('Role', {'fields': ('role',)}),
        ('Login Tracking', {'fields': ('last_login', 'last_login_at', 'last_login_ip')}),
        ('Lockout', {'fields': ('failed_login_attempts', 'lockout_until')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'role', 'password1', 'password2'),
        }),
    )
