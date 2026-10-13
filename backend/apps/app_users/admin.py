from django.contrib import admin

from apps.app_users.models import AppUser


@admin.register(AppUser)
class AppUserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'role_in_app', 'project', 'updated_by', 'updated_at']
    list_filter = ['role_in_app']
    search_fields = ['username', 'email', 'project__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
