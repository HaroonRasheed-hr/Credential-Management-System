from django.contrib import admin

from apps.env_variables.models import EnvVariable


@admin.register(EnvVariable)
class EnvVariableAdmin(admin.ModelAdmin):
    list_display = ['key', 'environment', 'project', 'updated_by', 'updated_at']
    list_filter = ['environment']
    search_fields = ['key', 'project__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
