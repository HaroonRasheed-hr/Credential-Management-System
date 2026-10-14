"""
Integration tests for the Projects module.

Covers:
- Project creation and slug auto-generation
- RBAC: system ADMIN sees all projects; DEVELOPER sees only their own
- ProjectMember management (add / remove)
- Secret masking in list responses
- Reveal endpoints return decrypted values
- Activity log is written on CRUD + reveal operations
"""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.activity_log.models import ActivityLog
from apps.projects.encryption import EncryptionService
from apps.projects.models import Project, ProjectMember
from apps.users.models import User

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MASKED = '••••••••'


def _make_user(email, role=User.Role.DEVELOPER, username=None):
    username = username or email.split('@')[0]
    return User.objects.create_user(
        email=email,
        username=username,
        password='TestPass123!',
        role=role,
    )


def _auth_client(user):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


def _create_project(user, name='Test Project', password='secret123'):
    client = _auth_client(user)
    response = client.post(
        '/api/v1/projects/',
        {'name': name, 'description': 'A test project', 'password': password},
        format='json',
    )
    return response


# ---------------------------------------------------------------------------
# Project creation
# ---------------------------------------------------------------------------

class ProjectCreationTests(TestCase):
    def setUp(self):
        self.admin_user = _make_user('admin@xis.ai', role=User.Role.ADMIN, username='admin')
        self.dev_user = _make_user('dev@xis.ai', role=User.Role.DEVELOPER, username='dev')

    def test_create_project_as_admin(self):
        response = _create_project(self.admin_user, name='Admin Project')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertIn('id', data['data'])

    def test_create_project_as_developer(self):
        response = _create_project(self.dev_user, name='Dev Project')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_slug_auto_generated(self):
        response = _create_project(self.admin_user, name='My Awesome Project')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project = Project.objects.get(pk=response.json()['data']['id'])
        self.assertEqual(project.slug, 'my-awesome-project')

    def test_slug_uniqueness(self):
        _create_project(self.admin_user, name='Slug Test')
        _create_project(self.dev_user, name='Slug Test')
        slugs = list(Project.objects.values_list('slug', flat=True))
        self.assertEqual(len(slugs), len(set(slugs)))

    def test_creator_added_as_admin_member(self):
        response = _create_project(self.dev_user, name='Dev Own Project')
        project_id = response.json()['data']['id']
        membership = ProjectMember.objects.get(
            project_id=project_id, user=self.dev_user
        )
        self.assertEqual(membership.role, ProjectMember.Role.ADMIN)

    def test_creation_logged(self):
        response = _create_project(self.admin_user, name='Logged Project')
        project_id = response.json()['data']['id']
        log = ActivityLog.objects.filter(
            project_id=project_id, action=ActivityLog.Action.CREATED
        ).first()
        self.assertIsNotNone(log)

    def test_unauthenticated_cannot_create(self):
        client = APIClient()
        response = client.post('/api/v1/projects/', {'name': 'Hack'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# RBAC — visibility
# ---------------------------------------------------------------------------

class ProjectVisibilityTests(TestCase):
    def setUp(self):
        self.admin_user = _make_user('admin2@xis.ai', role=User.Role.ADMIN, username='admin2')
        self.dev1 = _make_user('dev1@xis.ai', username='dev1')
        self.dev2 = _make_user('dev2@xis.ai', username='dev2')

        # dev1 creates a project
        resp = _create_project(self.dev1, name='Dev1 Project')
        self.dev1_project_id = resp.json()['data']['id']

        # dev2 creates a project
        resp = _create_project(self.dev2, name='Dev2 Project')
        self.dev2_project_id = resp.json()['data']['id']

    def test_system_admin_sees_all_projects(self):
        client = _auth_client(self.admin_user)
        response = client.get('/api/v1/projects/')
        self.assertEqual(response.status_code, 200)
        ids = [p['id'] for p in response.json()['results']]
        self.assertIn(self.dev1_project_id, ids)
        self.assertIn(self.dev2_project_id, ids)

    def test_developer_sees_only_own_projects(self):
        client = _auth_client(self.dev1)
        response = client.get('/api/v1/projects/')
        self.assertEqual(response.status_code, 200)
        ids = [p['id'] for p in response.json()['results']]
        self.assertIn(self.dev1_project_id, ids)
        self.assertNotIn(self.dev2_project_id, ids)

    def test_developer_sees_member_project(self):
        # Add dev1 to dev2's project
        dev2_client = _auth_client(self.dev2)
        dev2_client.post(
            f'/api/v1/projects/{self.dev2_project_id}/members/',
            {'user_id': str(self.dev1.id), 'role': 'DEVELOPER'},
            format='json',
        )
        client = _auth_client(self.dev1)
        response = client.get('/api/v1/projects/')
        ids = [p['id'] for p in response.json()['results']]
        self.assertIn(self.dev2_project_id, ids)

    def test_developer_cannot_access_other_project_detail(self):
        client = _auth_client(self.dev1)
        response = client.get(f'/api/v1/projects/{self.dev2_project_id}/')
        self.assertIn(response.status_code, [403, 404])


# ---------------------------------------------------------------------------
# Project admin vs developer within a project
# ---------------------------------------------------------------------------

class ProjectAdminRBACTests(TestCase):
    def setUp(self):
        self.owner = _make_user('owner@xis.ai', username='owner')
        self.member_dev = _make_user('memberdev@xis.ai', username='memberdev')
        self.outsider = _make_user('outsider@xis.ai', username='outsider')

        resp = _create_project(self.owner, name='RBAC Project')
        self.project_id = resp.json()['data']['id']

        # Add member_dev as DEVELOPER
        owner_client = _auth_client(self.owner)
        owner_client.post(
            f'/api/v1/projects/{self.project_id}/members/',
            {'user_id': str(self.member_dev.id), 'role': 'DEVELOPER'},
            format='json',
        )

    def test_project_admin_can_update_project(self):
        client = _auth_client(self.owner)
        response = client.patch(
            f'/api/v1/projects/{self.project_id}/',
            {'description': 'Updated description'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)

    def test_project_developer_cannot_delete_project(self):
        client = _auth_client(self.member_dev)
        response = client.delete(f'/api/v1/projects/{self.project_id}/')
        self.assertEqual(response.status_code, 403)

    def test_project_developer_cannot_add_members(self):
        client = _auth_client(self.member_dev)
        response = client.post(
            f'/api/v1/projects/{self.project_id}/members/',
            {'user_id': str(self.outsider.id), 'role': 'DEVELOPER'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_outsider_cannot_access_project(self):
        client = _auth_client(self.outsider)
        response = client.get(f'/api/v1/projects/{self.project_id}/')
        self.assertIn(response.status_code, [403, 404])

    def test_remove_member(self):
        client = _auth_client(self.owner)
        response = client.delete(
            f'/api/v1/projects/{self.project_id}/members/{self.member_dev.id}/'
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            ProjectMember.objects.filter(
                project_id=self.project_id, user=self.member_dev
            ).exists()
        )


# ---------------------------------------------------------------------------
# Secret masking — env variables
# ---------------------------------------------------------------------------

class SecretMaskingTests(TestCase):
    def setUp(self):
        from django.conf import settings as dj_settings
        from cryptography.fernet import Fernet

        # Ensure a FERNET_KEY is available for tests
        if not dj_settings.FERNET_KEY:
            dj_settings.FERNET_KEY = Fernet.generate_key().decode()

        self.user = _make_user('masktest@xis.ai', username='masktest')
        resp = _create_project(self.user, name='Mask Test Project')
        self.project_id = resp.json()['data']['id']
        self.client = _auth_client(self.user)

        # Create an env variable
        self.client.post(
            f'/api/v1/projects/{self.project_id}/env-variables/',
            {'key': 'DATABASE_URL', 'value': 'postgres://secret', 'environment': 'DEV'},
            format='json',
        )

    def test_list_returns_masked_value(self):
        response = self.client.get(
            f'/api/v1/projects/{self.project_id}/env-variables/'
        )
        self.assertEqual(response.status_code, 200)
        results = response.json()['results']
        self.assertTrue(len(results) > 0)
        self.assertEqual(results[0]['value'], MASKED)

    def test_reveal_returns_plaintext(self):
        # Get the env var id
        list_resp = self.client.get(
            f'/api/v1/projects/{self.project_id}/env-variables/'
        )
        env_var_id = list_resp.json()['results'][0]['id']

        response = self.client.get(
            f'/api/v1/projects/{self.project_id}/env-variables/{env_var_id}/reveal/'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['value'], 'postgres://secret')

    def test_reveal_logs_activity(self):
        list_resp = self.client.get(
            f'/api/v1/projects/{self.project_id}/env-variables/'
        )
        env_var_id = list_resp.json()['results'][0]['id']
        self.client.get(
            f'/api/v1/projects/{self.project_id}/env-variables/{env_var_id}/reveal/'
        )
        log = ActivityLog.objects.filter(
            project_id=self.project_id,
            action=ActivityLog.Action.REVEALED,
            module_name='EnvVariable',
            object_id=env_var_id,
        ).first()
        self.assertIsNotNone(log)


# ---------------------------------------------------------------------------
# Encryption unit tests
# ---------------------------------------------------------------------------

class EncryptionServiceTests(TestCase):
    def setUp(self):
        from django.conf import settings as dj_settings
        from cryptography.fernet import Fernet
        if not dj_settings.FERNET_KEY:
            dj_settings.FERNET_KEY = Fernet.generate_key().decode()
        # Reset cached Fernet instance so it picks up the new key
        EncryptionService._fernet = None

    def test_encrypt_decrypt_roundtrip(self):
        plaintext = 'super-secret-password-123'
        ciphertext = EncryptionService.encrypt(plaintext)
        self.assertNotEqual(ciphertext, plaintext)
        recovered = EncryptionService.decrypt(ciphertext)
        self.assertEqual(recovered, plaintext)

    def test_encrypt_empty_string_returns_empty(self):
        self.assertEqual(EncryptionService.encrypt(''), '')

    def test_decrypt_empty_string_returns_empty(self):
        self.assertEqual(EncryptionService.decrypt(''), '')

    def test_decrypt_corrupted_returns_input(self):
        result = EncryptionService.decrypt('not-valid-ciphertext')
        self.assertEqual(result, 'not-valid-ciphertext')


# ---------------------------------------------------------------------------
# Activity log
# ---------------------------------------------------------------------------

class ActivityLogTests(TestCase):
    def setUp(self):
        from django.conf import settings as dj_settings
        from cryptography.fernet import Fernet
        if not dj_settings.FERNET_KEY:
            dj_settings.FERNET_KEY = Fernet.generate_key().decode()
        EncryptionService._fernet = None

        self.user = _make_user('logtest@xis.ai', username='logtest')
        resp = _create_project(self.user, name='Log Test Project')
        self.project_id = resp.json()['data']['id']
        self.client = _auth_client(self.user)

    def test_activity_log_endpoint_returns_logs(self):
        response = self.client.get(
            f'/api/v1/projects/{self.project_id}/activity-log/'
        )
        self.assertEqual(response.status_code, 200)
        # At least one log from project creation
        self.assertGreater(response.json()['count'], 0)

    def test_outsider_cannot_read_activity_log(self):
        outsider = _make_user('outsider2@xis.ai', username='outsider2')
        client = _auth_client(outsider)
        response = client.get(
            f'/api/v1/projects/{self.project_id}/activity-log/'
        )
        self.assertIn(response.status_code, [403, 404])
