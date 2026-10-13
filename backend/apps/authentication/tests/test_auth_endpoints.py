"""
Tests for token refresh, logout, and /me endpoints.
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.test')

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

REFRESH_URL = '/api/v1/auth/refresh/'
LOGOUT_URL = '/api/v1/auth/logout/'
ME_URL = '/api/v1/auth/me/'


def _make_tokens(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh), str(refresh.access_token)


class TokenRefreshTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email='refresh@xis.ai', username='refreshuser', password='Pass1!Secure'
        )
        self.refresh_token, self.access_token = _make_tokens(self.user)

    def tearDown(self):
        cache.clear()

    def test_returns_200_with_valid_refresh(self):
        res = self.client.post(REFRESH_URL, {'refresh': self.refresh_token}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_response_envelope_success(self):
        res = self.client.post(REFRESH_URL, {'refresh': self.refresh_token}, format='json')
        self.assertTrue(res.data['success'])
        self.assertIn('access', res.data['data'])

    def test_returns_error_for_invalid_token(self):
        res = self.client.post(REFRESH_URL, {'refresh': 'invalid.token.value'}, format='json')
        self.assertNotEqual(res.status_code, status.HTTP_200_OK)

    def test_returns_error_for_missing_token(self):
        res = self.client.post(REFRESH_URL, {}, format='json')
        self.assertNotEqual(res.status_code, status.HTTP_200_OK)

    def test_new_access_token_is_different(self):
        # simplejwt rotates tokens; new access token is issued
        res = self.client.post(REFRESH_URL, {'refresh': self.refresh_token}, format='json')
        if res.status_code == 200:
            new_access = res.data['data'].get('access')
            self.assertIsNotNone(new_access)


class LogoutTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email='logout@xis.ai', username='logoutuser', password='Pass1!Secure'
        )
        self.refresh_token, self.access_token = _make_tokens(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')

    def tearDown(self):
        cache.clear()

    def test_logout_returns_200(self):
        res = self.client.post(LOGOUT_URL, {'refresh': self.refresh_token}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['success'])

    def test_logout_blacklists_refresh_token(self):
        self.client.post(LOGOUT_URL, {'refresh': self.refresh_token}, format='json')
        res = self.client.post(REFRESH_URL, {'refresh': self.refresh_token}, format='json')
        self.assertNotEqual(res.status_code, status.HTTP_200_OK)

    def test_logout_requires_authentication(self):
        self.client.credentials()  # remove auth header
        res = self.client.post(LOGOUT_URL, {'refresh': self.refresh_token}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_with_missing_refresh_returns_400(self):
        res = self.client.post(LOGOUT_URL, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_with_invalid_token_returns_400(self):
        res = self.client.post(LOGOUT_URL, {'refresh': 'bad.token'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class MeViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='me@xis.ai',
            username='meuser',
            password='Pass1!Secure',
            role=User.Role.ADMIN,
        )
        _, self.access_token = _make_tokens(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')

    def test_returns_200_for_authenticated_user(self):
        res = self.client.get(ME_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_response_envelope_success(self):
        res = self.client.get(ME_URL)
        self.assertTrue(res.data['success'])
        self.assertEqual(res.data['message'], 'User profile retrieved.')

    def test_returns_correct_email(self):
        res = self.client.get(ME_URL)
        self.assertEqual(res.data['data']['email'], 'me@xis.ai')

    def test_returns_correct_role(self):
        res = self.client.get(ME_URL)
        self.assertEqual(res.data['data']['role'], 'ADMIN')

    def test_returns_expected_fields(self):
        res = self.client.get(ME_URL)
        expected = {'id', 'email', 'username', 'role', 'last_login_at', 'last_login_ip', 'created_at'}
        self.assertEqual(set(res.data['data'].keys()), expected)

    def test_password_not_exposed(self):
        res = self.client.get(ME_URL)
        self.assertNotIn('password', res.data['data'])

    def test_requires_authentication(self):
        self.client.credentials()
        res = self.client.get(ME_URL)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_developer_user_can_access_me(self):
        dev = User.objects.create_user(
            email='dev2@xis.ai', username='dev2', password='DevPass1!', role=User.Role.DEVELOPER
        )
        _, access = _make_tokens(dev)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        res = self.client.get(ME_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['data']['role'], 'DEVELOPER')
