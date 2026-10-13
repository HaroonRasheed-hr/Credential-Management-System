from django.contrib import admin

from apps.activity_log.models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'module_name', 'object_id', 'user', 'project_name', 'timestamp']
    list_filter = ['action', 'module_name']
    search_fields = ['description', 'module_name', 'object_id', 'project_name', 'project__name']
    readonly_fields = [
        'id', 'project', 'project_name', 'user', 'action', 'module_name',
        'object_id', 'description', 'timestamp',
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
