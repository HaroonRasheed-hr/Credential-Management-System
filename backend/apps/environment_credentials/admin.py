from django.contrib import admin

from apps.environment_credentials.models import EnvironmentCredential


@admin.register(EnvironmentCredential)
class EnvironmentCredentialAdmin(admin.ModelAdmin):
    list_display = ['id', 'project', 'environment_type', 'system_name', 'updated_by', 'updated_at']
    list_filter = ['environment_type', 'created_at']
    search_fields = ['system_name', 'system_ip', 'project__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    raw_id_fields = ['project', 'updated_by']
