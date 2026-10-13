from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.projects.models import Project, ProjectMember
from apps.teams.models import Team, TeamMember

User = get_user_model()

PROFILE_URL = '/api/v1/settings/profile/'
CHANGE_PW_URL = '/api/v1/settings/change-password/'


def _auth(client, user):
    token = AccessToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token)}')


class ProfileViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            username='testuser',
            password='OldPass1!',
        )
        _auth(self.client, self.user)

    # ── GET ───────────────────────────────────────────────────────────────────

    def test_get_profile_returns_user_data(self):
        res = self.client.get(PROFILE_URL)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['success'])
        data = res.data['data']
        self.assertEqual(data['email'], 'test@example.com')
        self.assertEqual(data['username'], 'testuser')
        self.assertIn('stats', data)
        self.assertIn('joined', data)
        self.assertIn('full_name', data)

    def test_get_profile_returns_correct_stats(self):
        # Create project membership, team, and team member
        project = Project.objects.create(name='Proj', created_by=self.user)
        ProjectMember.objects.create(project=project, user=self.user, role='ADMIN')
        team = Team.objects.create(name='T1', created_by=self.user)
        other = User.objects.create_user(email='other@x.com', username='other', password='Pass1!')
        TeamMember.objects.create(team=team, user=other, role='DEVELOPER')

        res = self.client.get(PROFILE_URL)
        stats = res.data['data']['stats']
        self.assertEqual(stats['total_projects'], 1)
        self.assertEqual(stats['teams_managed'], 1)
        self.assertEqual(stats['team_members'], 1)

    # ── PATCH ─────────────────────────────────────────────────────────────────

    def test_update_first_name_succeeds(self):
        res = self.client.patch(PROFILE_URL, {'first_name': 'Alice'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['success'])
        self.assertEqual(res.data['data']['first_name'], 'Alice')
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Alice')

    def test_update_username_taken_returns_400(self):
        User.objects.create_user(email='b@x.com', username='taken', password='Pass1!')
        res = self.client.patch(PROFILE_URL, {'username': 'taken'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'USERNAME_TAKEN')

    def test_update_email_taken_returns_400(self):
        User.objects.create_user(email='used@x.com', username='other2', password='Pass1!')
        res = self.client.patch(PROFILE_URL, {'email': 'used@x.com'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'EMAIL_TAKEN')

    def test_unauthenticated_request_returns_401(self):
        self.client.credentials()
        res = self.client.get(PROFILE_URL)
        self.assertEqual(res.status_code, 401)


class ChangePasswordViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='pw@example.com',
            username='pwuser',
            password='OldPass1!',
        )
        _auth(self.client, self.user)

    def _payload(self, current='OldPass1!', new='NewPass2@', confirm='NewPass2@'):
        return {
            'current_password': current,
            'new_password': new,
            'confirm_password': confirm,
        }

    def test_correct_current_password_changes_successfully(self):
        res = self.client.post(CHANGE_PW_URL, self._payload(), format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['success'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass2@'))

    def test_wrong_current_password_returns_400(self):
        res = self.client.post(CHANGE_PW_URL, self._payload(current='WrongPass!'), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'INVALID_CURRENT_PASSWORD')

    def test_mismatched_new_passwords_returns_400(self):
        res = self.client.post(
            CHANGE_PW_URL,
            self._payload(new='NewPass2@', confirm='Different1!'),
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'PASSWORD_MISMATCH')

    def test_new_same_as_current_returns_400(self):
        res = self.client.post(
            CHANGE_PW_URL,
            self._payload(new='OldPass1!', confirm='OldPass1!'),
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'PASSWORD_SAME_AS_CURRENT')

    def test_weak_new_password_returns_400(self):
        res = self.client.post(
            CHANGE_PW_URL,
            self._payload(new='weakpass', confirm='weakpass'),
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.data['success'])

    def test_password_change_invalidates_refresh_tokens(self):
        refresh = RefreshToken.for_user(self.user)
        jti = refresh['jti']

        res = self.client.post(CHANGE_PW_URL, self._payload(), format='json')
        self.assertEqual(res.status_code, 200)

        token_obj = OutstandingToken.objects.get(jti=jti)
        self.assertTrue(BlacklistedToken.objects.filter(token=token_obj).exists())
