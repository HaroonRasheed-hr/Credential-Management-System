from django.contrib import admin

from apps.admin_credentials.models import AdminCredential


@admin.register(AdminCredential)
class AdminCredentialAdmin(admin.ModelAdmin):
    list_display = ['username', 'admin_panel_url', 'project', 'updated_by', 'updated_at']
    search_fields = ['username', 'admin_panel_url', 'project__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
