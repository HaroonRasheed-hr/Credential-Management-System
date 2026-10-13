from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from rest_framework.exceptions import ValidationError

from apps.settings_profile.serializers import (
    ChangePasswordSerializer,
    ProfileSerializer,
    UpdateProfileSerializer,
)
from apps.projects.models import Project, ProjectMember
from apps.teams.models import Team, TeamMember

User = get_user_model()


class ProfileSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='s@example.com',
            username='seruser',
            password='Pass1!',
            first_name='Jane',
            last_name='Doe',
        )

    def test_full_name_combines_first_and_last(self):
        data = ProfileSerializer(self.user).data
        self.assertEqual(data['full_name'], 'Jane Doe')

    def test_full_name_falls_back_to_username_when_names_empty(self):
        self.user.first_name = ''
        self.user.last_name = ''
        self.user.save()
        data = ProfileSerializer(self.user).data
        self.assertEqual(data['full_name'], 'seruser')

    def test_role_display_admin(self):
        self.user.role = 'ADMIN'
        self.user.save()
        data = ProfileSerializer(self.user).data
        self.assertEqual(data['role_display'], 'Admin')

    def test_role_display_developer(self):
        self.user.role = 'DEVELOPER'
        self.user.save()
        data = ProfileSerializer(self.user).data
        self.assertEqual(data['role_display'], 'Developer')

    def test_stats_total_projects(self):
        project = Project.objects.create(name='P1', created_by=self.user)
        ProjectMember.objects.create(project=project, user=self.user, role='ADMIN')
        data = ProfileSerializer(self.user).data
        self.assertEqual(data['stats']['total_projects'], 1)

    def test_stats_teams_managed(self):
        Team.objects.create(name='T1', created_by=self.user)
        data = ProfileSerializer(self.user).data
        self.assertEqual(data['stats']['teams_managed'], 1)

    def test_stats_team_members(self):
        team = Team.objects.create(name='T2', created_by=self.user)
        other = User.objects.create_user(email='o@x.com', username='other', password='P1!')
        TeamMember.objects.create(team=team, user=other, role='DEVELOPER')
        data = ProfileSerializer(self.user).data
        self.assertEqual(data['stats']['team_members'], 1)


class UpdateProfileSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='up@example.com', username='upuser', password='Pass1!'
        )

    def test_valid_partial_update(self):
        s = UpdateProfileSerializer(self.user, data={'first_name': 'Bob'}, partial=True)
        self.assertTrue(s.is_valid(), s.errors)
        s.save()
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Bob')

    def test_duplicate_username_raises_error(self):
        User.objects.create_user(email='x@x.com', username='taken', password='Pass1!')
        s = UpdateProfileSerializer(self.user, data={'username': 'taken'}, partial=True)
        self.assertFalse(s.is_valid())
        self.assertIn('username', s.errors)

    def test_duplicate_email_raises_error(self):
        User.objects.create_user(email='dup@x.com', username='other3', password='Pass1!')
        s = UpdateProfileSerializer(self.user, data={'email': 'dup@x.com'}, partial=True)
        self.assertFalse(s.is_valid())
        self.assertIn('email', s.errors)

    def test_email_normalised_to_lowercase(self):
        s = UpdateProfileSerializer(self.user, data={'email': 'UPPER@EXAMPLE.COM'}, partial=True)
        self.assertTrue(s.is_valid(), s.errors)
        s.save()
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'upper@example.com')

    def test_invalid_username_format_raises_error(self):
        s = UpdateProfileSerializer(self.user, data={'username': 'bad name!'}, partial=True)
        self.assertFalse(s.is_valid())
        self.assertIn('username', s.errors)


class ChangePasswordSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='cp@example.com', username='cpuser', password='OldPass1!'
        )
        self.factory = RequestFactory()

    def _serializer(self, data):
        request = self.factory.post('/')
        request.user = self.user
        return ChangePasswordSerializer(data=data, context={'request': request})

    def test_valid_password_change(self):
        s = self._serializer({
            'current_password': 'OldPass1!',
            'new_password': 'NewPass2@',
            'confirm_password': 'NewPass2@',
        })
        self.assertTrue(s.is_valid(), s.errors)

    def test_wrong_current_password_is_invalid(self):
        s = self._serializer({
            'current_password': 'Wrong!',
            'new_password': 'NewPass2@',
            'confirm_password': 'NewPass2@',
        })
        self.assertFalse(s.is_valid())
        self.assertIn('current_password', s.errors)

    def test_mismatched_passwords_is_invalid(self):
        s = self._serializer({
            'current_password': 'OldPass1!',
            'new_password': 'NewPass2@',
            'confirm_password': 'Different1!',
        })
        self.assertFalse(s.is_valid())
        self.assertIn('confirm_password', s.errors)

    def test_same_as_current_is_invalid(self):
        s = self._serializer({
            'current_password': 'OldPass1!',
            'new_password': 'OldPass1!',
            'confirm_password': 'OldPass1!',
        })
        self.assertFalse(s.is_valid())
        self.assertIn('non_field_errors', s.errors)

    def test_weak_password_is_invalid(self):
        s = self._serializer({
            'current_password': 'OldPass1!',
            'new_password': 'weakpass',
            'confirm_password': 'weakpass',
        })
        self.assertFalse(s.is_valid())
        self.assertIn('new_password', s.errors)
