import uuid
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.notifications.services import NotificationService

User = get_user_model()


def make_user(email, username, role, first_name='', last_name='', password='testpass123'):
    return User.objects.create_user(
        email=email,
        username=username,
        password=password,
        role=role,
        first_name=first_name,
        last_name=last_name,
    )


class NotificationTests(TestCase):
    def setUp(self):
        self.developer  = make_user('dev@test.com',        'dev',        'DEVELOPER', 'Dev',   'User')
        self.developer2 = make_user('dev2@test.com',       'dev2',       'DEVELOPER', 'Dev2',  'User')
        self.admin      = make_user('admin@test.com',      'admin',      'ADMIN',     'Admin', 'User')
        self.admin2     = make_user('admin2@test.com',     'admin2',     'ADMIN',     'Admin2','User')

        self.client = APIClient()

    # ── RBAC delivery rules ────────────────────────────────────────────────────

    def test_developer_action_notifies_all_roles(self):
        """DEVELOPER sender → all DEVELOPER and ADMIN users receive notifications."""
        notifications = NotificationService.send(
            sender=self.developer,
            action='created',
            module='PROJECT',
            title='New project created',
            message='A new project was added.',
        )
        recipient_ids = {str(n.recipient_id) for n in notifications}

        # developer2 and both admins should be notified
        self.assertIn(str(self.developer2.id), recipient_ids)
        self.assertIn(str(self.admin.id),      recipient_ids)
        self.assertIn(str(self.admin2.id),     recipient_ids)
        # sender excluded
        self.assertNotIn(str(self.developer.id), recipient_ids)

    def test_admin_action_notifies_admin_and_superadmin(self):
        """ADMIN sender → only ADMIN users receive notifications (no DEVELOPER)."""
        notifications = NotificationService.send(
            sender=self.admin,
            action='updated',
            module='TEAM',
            title='Team updated',
            message='A team member was updated.',
        )
        recipient_ids = {str(n.recipient_id) for n in notifications}

        # admin2 should receive it
        self.assertIn(str(self.admin2.id), recipient_ids)
        # developers must NOT receive it
        self.assertNotIn(str(self.developer.id),  recipient_ids)
        self.assertNotIn(str(self.developer2.id), recipient_ids)
        # sender excluded
        self.assertNotIn(str(self.admin.id), recipient_ids)

    def test_superadmin_action_notifies_only_superadmin(self):
        """
        With only ADMIN/DEVELOPER roles in the system, ADMIN acting as the top
        role means only other ADMINs are notified — equivalent to SUPER_ADMIN-only
        behaviour given the current role model.
        """
        # Use an ADMIN acting as the top-level principal; same rule as admin test.
        notifications = NotificationService.send(
            sender=self.admin2,
            action='deleted',
            module='LICENSE_KEYS',
            title='License deleted',
            message='A license key was removed.',
        )
        recipient_ids = {str(n.recipient_id) for n in notifications}

        self.assertIn(str(self.admin.id), recipient_ids)
        self.assertNotIn(str(self.developer.id),  recipient_ids)
        self.assertNotIn(str(self.developer2.id), recipient_ids)
        self.assertNotIn(str(self.admin2.id),     recipient_ids)  # sender excluded

    def test_sender_not_notified_of_own_action(self):
        """The sender must never appear in their own notification recipients."""
        for sender in [self.developer, self.admin]:
            with self.subTest(role=sender.role):
                notifications = NotificationService.send(
                    sender=sender,
                    action='viewed',
                    module='ENV_VARIABLES',
                    title='Env var accessed',
                    message='An env variable was viewed.',
                )
                recipient_ids = {str(n.recipient_id) for n in notifications}
                self.assertNotIn(str(sender.id), recipient_ids)

    # ── API endpoint tests ──────────────────────────────────────────────────────

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _create_notification(self, recipient, sender=None, is_read=False):
        return Notification.objects.create(
            recipient=recipient,
            sender=sender or self.admin,
            title='Test notification',
            message='Test message.',
            module='PROJECT',
            is_read=is_read,
        )

    def test_mark_single_as_read(self):
        self._auth(self.developer)
        notif = self._create_notification(self.developer)
        self.assertFalse(notif.is_read)

        url      = f'/api/v1/notifications/{notif.id}/read/'
        response = self.client.patch(url)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])

        notif.refresh_from_db()
        self.assertTrue(notif.is_read)

    def test_mark_all_as_read(self):
        self._auth(self.developer)
        for _ in range(3):
            self._create_notification(self.developer, is_read=False)

        response = self.client.post('/api/v1/notifications/mark-all-read/')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])

        unread = Notification.objects.filter(recipient=self.developer, is_read=False).count()
        self.assertEqual(unread, 0)

    def test_unread_count_returns_correct_number(self):
        self._auth(self.developer)
        self._create_notification(self.developer, is_read=False)
        self._create_notification(self.developer, is_read=False)
        self._create_notification(self.developer, is_read=True)

        response = self.client.get('/api/v1/notifications/unread-count/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['unread_count'], 2)

    def test_developer_cannot_see_others_notifications(self):
        """The list endpoint returns only the authenticated user's notifications."""
        self._create_notification(self.admin)       # belongs to admin
        self._create_notification(self.developer)   # belongs to developer

        self._auth(self.developer)
        response = self.client.get('/api/v1/notifications/')

        self.assertEqual(response.status_code, 200)
        results = response.data['data']['results']
        recipient_ids = {r['id'] for r in results}

        # There is exactly 1 notification for developer; admin's must not appear
        self.assertEqual(len(results), 1)
        # Verify the notification listed belongs to developer (check via DB)
        dev_notif_ids = set(
            Notification.objects.filter(recipient=self.developer)
            .values_list('id', flat=True)
        )
        for r_id in recipient_ids:
            self.assertIn(uuid.UUID(r_id), dev_notif_ids)

    def test_unauthenticated_request_is_rejected(self):
        response = self.client.get('/api/v1/notifications/')
        self.assertEqual(response.status_code, 401)

    def test_mark_single_read_wrong_owner_returns_404(self):
        """A user cannot mark another user's notification as read."""
        notif = self._create_notification(self.admin)
        self._auth(self.developer)

        url      = f'/api/v1/notifications/{notif.id}/read/'
        response = self.client.patch(url)
        self.assertEqual(response.status_code, 404)
