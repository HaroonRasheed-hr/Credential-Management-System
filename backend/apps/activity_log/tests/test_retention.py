"""
Tests for the activity-log retention rule.

Core requirement: deleting a project must NOT delete its activity logs.
The logs are retained (project FK is nulled) and keep a denormalized
``project_name`` so they remain meaningful after the project is gone.
"""

from django.test import TestCase

from apps.activity_log.models import ActivityLog
from apps.projects.models import Project
from apps.projects.services import ProjectService
from apps.users.models import User


class ActivityLogRetentionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='owner@example.com',
            username='owner',
            password='TestPass123!',
            role=User.Role.ADMIN,
        )
        self.project = Project.objects.create(name='Acme', created_by=self.user)

    def _log(self):
        ProjectService.log_activity(
            project=self.project,
            user=self.user,
            action=ActivityLog.Action.CREATED,
            module_name='ENV_VARIABLES',
            object_id='123',
            description='Added an env variable.',
        )

    def test_project_name_is_captured_on_write(self):
        self._log()
        log = ActivityLog.objects.get()
        self.assertEqual(log.project_name, 'Acme')

    def test_logs_survive_project_deletion(self):
        self._log()
        self.assertEqual(ActivityLog.objects.count(), 1)

        self.project.delete()

        # The log row still exists ...
        self.assertEqual(ActivityLog.objects.count(), 1)
        log = ActivityLog.objects.get()
        # ... the FK is nulled (not cascaded) ...
        self.assertIsNone(log.project_id)
        # ... and the project name is still available for the audit trail.
        self.assertEqual(log.project_name, 'Acme')
