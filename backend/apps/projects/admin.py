from django.contrib import admin

from apps.projects.models import Project, ProjectMember


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'status', 'created_by', 'created_at']
    list_filter = ['status']
    search_fields = ['name', 'slug']
    readonly_fields = ['id', 'slug', 'created_at', 'updated_at']


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = ['project', 'user', 'role', 'added_by', 'added_at']
    list_filter = ['role']
    search_fields = ['project__name', 'user__email']
