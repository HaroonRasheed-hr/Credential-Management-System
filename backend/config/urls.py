from django.contrib import admin
from django.urls import path, include

from utils.frontend import serve_frontend

urlpatterns = [
    path("admin/",                  admin.site.urls),
    path("api/v1/auth/",            include("apps.authentication.urls")),
    path("api/v1/projects/",        include("apps.projects.urls")),
    path("api/v1/teams/",           include("apps.teams.urls")),
    path("api/v1/settings/",        include("apps.settings_profile.urls")),
    path("api/v1/reports/",         include("apps.reports.urls")),
    path("api/v1/notifications/",   include("apps.notifications.urls")),
    path("api/v1/devices/",         include("apps.device_credentials.urls")),
    # ── Frontend catch-all (must be last) ─────────────────────────────────────
    path("<path:path>",             serve_frontend),
    path("",                        serve_frontend),
]
