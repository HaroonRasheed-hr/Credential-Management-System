"""
Tests for POST /api/v1/auth/login/
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.test')

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()
LOGIN_URL = '/api/v1/auth/login/'


class LoginSuccessTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email='dev@xis.ai',
            username='devuser',
            password='SecurePass1!',
            role=User.Role.DEVELOPER,
        )

    def tearDown(self):
        cache.clear()

    def _login(self, email='dev@xis.ai', password='SecurePass1!'):
        return self.client.post(LOGIN_URL, {'email': email, 'password': password}, format='json')

    def test_returns_200_on_valid_credentials(self):
        res = self._login()
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_response_envelope_success(self):
        res = self._login()
        self.assertTrue(res.data['success'])
        self.assertEqual(res.data['message'], 'Login successful.')

    def test_response_contains_access_token(self):
        res = self._login()
        self.assertIn('access', res.data['data'])

    def test_response_contains_refresh_token(self):
        res = self._login()
        self.assertIn('refresh', res.data['data'])

    def test_response_contains_user_object(self):
        res = self._login()
        user_data = res.data['data']['user']
        self.assertEqual(user_data['email'], 'dev@xis.ai')
        self.assertEqual(user_data['role'], 'DEVELOPER')
        self.assertIn('id', user_data)

    def test_email_lookup_is_case_insensitive(self):
        res = self._login(email='DEV@XIS.AI')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_updates_last_login_at_on_success(self):
        self.assertIsNone(self.user.last_login_at)
        self._login()
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login_at)

    def test_resets_failed_attempts_on_success(self):
        # Rack up one failure first
        self.client.post(LOGIN_URL, {'email': 'dev@xis.ai', 'password': 'wrong'}, format='json')
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 1)

        # Correct login resets the counter
        self._login()
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 0)
        self.assertIsNone(self.user.lockout_until)

    def test_admin_user_can_login(self):
        admin = User.objects.create_user(
            email='admin@xis.ai', username='adminuser', password='AdminPass1!', role=User.Role.ADMIN
        )
        res = self.client.post(LOGIN_URL, {'email': 'admin@xis.ai', 'password': 'AdminPass1!'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['data']['user']['role'], 'ADMIN')


class LoginFailureTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email='user@xis.ai',
            username='someuser',
            password='CorrectPass1!',
        )

    def tearDown(self):
        cache.clear()

    def test_wrong_password_returns_401(self):
        res = self.client.post(LOGIN_URL, {'email': 'user@xis.ai', 'password': 'WrongPass!'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(res.data['success'])

    def test_nonexistent_email_returns_401(self):
        res = self.client.post(LOGIN_URL, {'email': 'ghost@xis.ai', 'password': 'Pass1!'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_email_format_returns_400(self):
        res = self.client.post(LOGIN_URL, {'email': 'not-valid', 'password': 'Pass1!'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_password_returns_400(self):
        res = self.client.post(LOGIN_URL, {'email': 'user@xis.ai'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_email_returns_400(self):
        res = self.client.post(LOGIN_URL, {'password': 'Pass1!'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_body_returns_400(self):
        res = self.client.post(LOGIN_URL, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inactive_user_returns_401(self):
        self.user.is_active = False
        self.user.save()
        res = self.client.post(LOGIN_URL, {'email': 'user@xis.ai', 'password': 'CorrectPass1!'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_failure_increments_db_counter(self):
        self.client.post(LOGIN_URL, {'email': 'user@xis.ai', 'password': 'wrong'}, format='json')
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 1)

    def test_error_response_has_code_field(self):
        res = self.client.post(LOGIN_URL, {'email': 'user@xis.ai', 'password': 'wrong'}, format='json')
        self.assertIn('code', res.data)
        self.assertEqual(res.data['code'], 'invalid_credentials')
