from django.urls import path

from apps.reports.views import ActivityReportView, RecentActivityView

urlpatterns = [
    path('activity/', ActivityReportView.as_view(), name='export-activity-report'),
    path('recent-activity/', RecentActivityView.as_view(), name='recent-activity'),
]
