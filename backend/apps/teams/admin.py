from django.contrib import admin

from apps.teams.models import Team, TeamMember


class TeamMemberInline(admin.TabularInline):
    model = TeamMember
    extra = 0
    readonly_fields = ['added_at']
    raw_id_fields = ['user', 'added_by']


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_by', 'created_at']
    search_fields = ['name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    inlines = [TeamMemberInline]


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ['team', 'user', 'role', 'added_by', 'added_at']
    list_filter = ['role']
    search_fields = ['team__name', 'user__email', 'user__username']
    readonly_fields = ['id', 'added_at']
