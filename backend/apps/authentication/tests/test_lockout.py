"""
Tests for the account lockout system.

Covers both the Redis (fast path) and database (persistent) layers, plus the
AuthService helper methods used directly by the middleware.
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.test')

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.services import AuthService

User = get_user_model()
LOGIN_URL = '/api/v1/auth/login/'


class LockoutEndpointTests(APITestCase):
    """Integration tests — hit the real HTTP layer."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email='target@xis.ai',
            username='targetuser',
            password='CorrectPass1!',
        )

    def tearDown(self):
        cache.clear()

    def _fail(self, n: int = 1):
        for _ in range(n):
            self.client.post(
                LOGIN_URL,
                {'email': 'target@xis.ai', 'password': 'WrongPassword!'},
                format='json',
            )

    def test_third_failure_returns_423(self):
        self._fail(2)
        res = self.client.post(
            LOGIN_URL, {'email': 'target@xis.ai', 'password': 'WrongPassword!'}, format='json'
        )
        self.assertEqual(res.status_code, 423)
        self.assertEqual(res.data['code'], 'account_locked')

    def test_correct_password_blocked_after_lockout(self):
        self._fail(3)
        res = self.client.post(
            LOGIN_URL, {'email': 'target@xis.ai', 'password': 'CorrectPass1!'}, format='json'
        )
        self.assertIn(res.status_code, (423, 423))  # still locked
        self.assertEqual(res.data['code'], 'account_locked')

    def test_lockout_sets_redis_flag(self):
        self._fail(3)
        locked = cache.get(f'login_lockout:target@xis.ai')
        self.assertTrue(locked)

    def test_lockout_sets_db_lockout_until(self):
        self._fail(3)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.lockout_until)

    def test_failed_attempts_tracked_in_redis(self):
        self._fail(2)
        count = cache.get('login_attempts:target@xis.ai')
        self.assertEqual(count, 2)

    def test_failed_attempts_tracked_in_db(self):
        self._fail(2)
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 2)

    def test_successful_login_clears_redis_counter(self):
        self._fail(2)
        self.client.post(
            LOGIN_URL, {'email': 'target@xis.ai', 'password': 'CorrectPass1!'}, format='json'
        )
        count = cache.get('login_attempts:target@xis.ai')
        self.assertFalse(bool(count))

    def test_successful_login_clears_db_counter(self):
        self._fail(2)
        self.client.post(
            LOGIN_URL, {'email': 'target@xis.ai', 'password': 'CorrectPass1!'}, format='json'
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 0)
        self.assertIsNone(self.user.lockout_until)

    def test_response_includes_retry_after(self):
        self._fail(3)
        res = self.client.post(
            LOGIN_URL, {'email': 'target@xis.ai', 'password': 'CorrectPass1!'}, format='json'
        )
        self.assertIn('retry_after', res.data)

    def test_remaining_attempts_info_in_failure_message(self):
        res = self.client.post(
            LOGIN_URL, {'email': 'target@xis.ai', 'password': 'WrongPassword!'}, format='json'
        )
        self.assertIn('attempt', res.data['message'].lower())


class LockoutServiceTests(APITestCase):
    """Unit tests for AuthService lockout helpers (no HTTP layer)."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email='svc@xis.ai',
            username='svcuser',
            password='ServicePass1!',
        )

    def tearDown(self):
        cache.clear()

    def test_is_account_locked_false_initially(self):
        self.assertFalse(AuthService.is_account_locked('svc@xis.ai'))

    def test_record_failed_attempt_increments(self):
        count = AuthService.record_failed_attempt('svc@xis.ai')
        self.assertEqual(count, 1)
        count = AuthService.record_failed_attempt('svc@xis.ai')
        self.assertEqual(count, 2)

    def test_account_locked_after_max_attempts(self):
        for _ in range(3):
            AuthService.record_failed_attempt('svc@xis.ai')
        self.assertTrue(AuthService.is_account_locked('svc@xis.ai'))

    def test_clear_failed_attempts_unlocks_account(self):
        for _ in range(3):
            AuthService.record_failed_attempt('svc@xis.ai')
        AuthService.clear_failed_attempts('svc@xis.ai')
        self.assertFalse(AuthService.is_account_locked('svc@xis.ai'))

    def test_clear_resets_db_fields(self):
        for _ in range(3):
            AuthService.record_failed_attempt('svc@xis.ai')
        AuthService.clear_failed_attempts('svc@xis.ai')
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 0)
        self.assertIsNone(self.user.lockout_until)

    def test_is_account_locked_falls_back_to_db(self):
        # Write directly to DB, bypassing Redis
        from django.utils import timezone
        from datetime import timedelta
        self.user.lockout_until = timezone.now() + timedelta(minutes=5)
        self.user.save(update_fields=['lockout_until'])

        cache.clear()  # wipe Redis so only DB path fires
        self.assertTrue(AuthService.is_account_locked('svc@xis.ai'))

    def test_unknown_email_attempt_does_not_crash(self):
        count = AuthService.record_failed_attempt('nobody@xis.ai')
        self.assertEqual(count, 1)
