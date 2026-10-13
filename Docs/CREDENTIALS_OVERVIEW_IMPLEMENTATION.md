Credentials Overview — Backend Implementation

Overview

The Credentials Overview feature provides a secure API to store, retrieve, and update system credentials for two environments per project: Development and Deployment.

Each environment stores the following fields:

System Name
System IP
Admin Password (encrypted at rest)
RustDesk IP
RustDesk Password (encrypted at rest)

Architecture

The implementation follows the same patterns used in admin_credentials, env_variables, and license_keys to keep the codebase consistent.

The feature is built around five components:

Django app: apps.environment_credentials
Database table: environment_credentials
API endpoints under /api/v1/projects/{project_id}/environment-credentials/
Fernet encryption via the existing EncryptionService
Activity logging via the existing activity log system

New projects automatically get empty Development and Deployment credential records on creation via a post-save signal on the Project model.

Files Created

Model — apps/environment_credentials/models.py

pythonimport uuid

from django.conf import settings
from django.db import models

class EnvironmentCredential(models.Model):

    class EnvironmentType(models.TextChoices):
        DEVELOPMENT = 'DEVELOPMENT', 'Development'
        DEPLOYMENT = 'DEPLOYMENT', 'Deployment'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='environment_credentials',
    )
    environment_type = models.CharField(max_length=20, choices=EnvironmentType.choices)
    system_name = models.CharField(max_length=255, blank=True)
    system_ip = models.CharField(max_length=255, blank=True)
    admin_password = models.TextField(blank=True)
    rustdesk_ip = models.CharField(max_length=255, blank=True)
    rustdesk_password = models.TextField(blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'environment_credentials'
        ordering = ['environment_type']
        unique_together = ('project', 'environment_type')

    def __str__(self) -> str:
        return f'{self.environment_type} - {self.system_name or "Unnamed"}'

The unique constraint on (project, environment_type) ensures exactly one Development record and one Deployment record per project. UUID primary keys are used across the board for consistency with the rest of the project.

Serializers — apps/environment_credentials/serializers.py

Three serializers handle different scenarios:

pythonfrom rest_framework import serializers

from apps.environment_credentials.models import EnvironmentCredential
from apps.projects.encryption import EncryptionService
from apps.projects.serializers import UserMinimalSerializer

MASKED = '••••••••'

class EnvironmentCredentialListSerializer(serializers.ModelSerializer):
admin_password = serializers.SerializerMethodField()
rustdesk_password = serializers.SerializerMethodField()
updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = EnvironmentCredential
        fields = [
            'id', 'environment_type', 'system_name', 'system_ip', 'admin_password',
            'rustdesk_ip', 'rustdesk_password', 'updated_by', 'created_at', 'updated_at',
        ]

    def get_admin_password(self, obj) -> str:
        return MASKED if obj.admin_password else ''

    def get_rustdesk_password(self, obj) -> str:
        return MASKED if obj.rustdesk_password else ''

class EnvironmentCredentialWriteSerializer(serializers.ModelSerializer):

    class Meta:
        model = EnvironmentCredential
        fields = [
            'system_name', 'system_ip', 'admin_password',
            'rustdesk_ip', 'rustdesk_password',
        ]
        extra_kwargs = {
            'system_name': {'required': False, 'allow_blank': True},
            'system_ip': {'required': False, 'allow_blank': True},
            'admin_password': {'required': False, 'allow_blank': True},
            'rustdesk_ip': {'required': False, 'allow_blank': True},
            'rustdesk_password': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        if validated_data.get('admin_password'):
            validated_data['admin_password'] = EncryptionService.encrypt(validated_data['admin_password'])
        if validated_data.get('rustdesk_password'):
            validated_data['rustdesk_password'] = EncryptionService.encrypt(validated_data['rustdesk_password'])
        validated_data['updated_by'] = self.context['request'].user
        validated_data['project'] = self.context['project']
        validated_data['environment_type'] = self.context['environment_type']
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'admin_password' in validated_data and validated_data['admin_password']:
            validated_data['admin_password'] = EncryptionService.encrypt(validated_data['admin_password'])
        if 'rustdesk_password' in validated_data and validated_data['rustdesk_password']:
            validated_data['rustdesk_password'] = EncryptionService.encrypt(validated_data['rustdesk_password'])
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)

class EnvironmentCredentialRevealSerializer(serializers.ModelSerializer):
admin_password = serializers.SerializerMethodField()
rustdesk_password = serializers.SerializerMethodField()
updated_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = EnvironmentCredential
        fields = [
            'id', 'environment_type', 'system_name', 'system_ip', 'admin_password',
            'rustdesk_ip', 'rustdesk_password', 'updated_by', 'created_at', 'updated_at',
        ]

    def get_admin_password(self, obj) -> str:
        return EncryptionService.decrypt(obj.admin_password) if obj.admin_password else ''

    def get_rustdesk_password(self, obj) -> str:
        return EncryptionService.decrypt(obj.rustdesk_password) if obj.rustdesk_password else ''

The list serializer always masks passwords. The write serializer encrypts before saving and only re-encrypts a password field if a new value was actually sent. The reveal serializer decrypts and returns the plaintext — only called on an explicit reveal request.

Views — apps/environment_credentials/views.py

pythonimport logging

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.activity_log.models import ActivityLog
from apps.environment_credentials.models import EnvironmentCredential
from apps.environment_credentials.serializers import (
EnvironmentCredentialListSerializer,
EnvironmentCredentialRevealSerializer,
EnvironmentCredentialWriteSerializer,
)
from apps.projects.models import Project
from apps.projects.permissions import IsProjectMember
from apps.projects.services import ProjectService
from utils.responses import error_response, success_response

logger = logging.getLogger(**name**)

def \_get_project_or_404(project_id):
return get_object_or_404(Project, pk=project_id)

class EnvironmentCredentialListView(APIView):
permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        creds = EnvironmentCredential.objects.filter(project=project).select_related('updated_by')
        serializer = EnvironmentCredentialListSerializer(creds, many=True)
        return success_response('Environment credentials retrieved.', data=serializer.data)

class EnvironmentCredentialDetailView(APIView):
permission_classes = [IsAuthenticated, IsProjectMember]

    def _get_object(self, project_id, pk):
        project = _get_project_or_404(project_id)
        cred = get_object_or_404(EnvironmentCredential, pk=pk, project=project)
        return project, cred

    def patch(self, request, project_id, pk):
        project, cred = self._get_object(project_id, pk)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        serializer = EnvironmentCredentialWriteSerializer(
            cred,
            data=request.data,
            partial=True,
            context={'request': request, 'project': project, 'environment_type': cred.environment_type},
        )
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)
        cred = serializer.save()
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.UPDATED,
            module_name='EnvironmentCredential',
            object_id=str(cred.id),
            description=f'{cred.environment_type} environment credentials updated.',
        )
        return success_response(
            'Environment credentials updated.',
            data=EnvironmentCredentialListSerializer(cred).data,
        )

class EnvironmentCredentialRevealView(APIView):
permission_classes = [IsAuthenticated, IsProjectMember]

    def get(self, request, project_id, pk):
        project = _get_project_or_404(project_id)
        if not ProjectService.is_project_accessible(request.user, project):
            return error_response('Project not found.', status=404)
        cred = get_object_or_404(EnvironmentCredential, pk=pk, project=project)
        ProjectService.log_activity(
            project=project,
            user=request.user,
            action=ActivityLog.Action.REVEALED,
            module_name='EnvironmentCredential',
            object_id=str(cred.id),
            description=f'{cred.environment_type} environment credentials revealed.',
        )
        return success_response(
            'Environment credentials revealed.',
            data=EnvironmentCredentialRevealSerializer(cred).data,
        )

Signal — apps/environment_credentials/signals.py

pythonfrom django.db.models.signals import post_save
from django.dispatch import receiver

from apps.environment_credentials.models import EnvironmentCredential
from apps.projects.models import Project

@receiver(post_save, sender=Project)
def create_default_environment_credentials(sender, instance, created, \*\*kwargs):
if created:
for env_type in [
EnvironmentCredential.EnvironmentType.DEVELOPMENT,
EnvironmentCredential.EnvironmentType.DEPLOYMENT,
]:
EnvironmentCredential.objects.create(
project=instance,
environment_type=env_type,
system_name='',
system_ip='',
admin_password='',
rustdesk_ip='',
rustdesk_password='',
updated_by=instance.created_by,
)

URLs — apps/environment_credentials/urls.py

pythonfrom django.urls import path

from apps.environment_credentials.views import (
EnvironmentCredentialDetailView,
EnvironmentCredentialListView,
EnvironmentCredentialRevealView,
)

urlpatterns = [
path('', EnvironmentCredentialListView.as_view(), name='environment-credentials-list'),
path('<uuid:pk>/', EnvironmentCredentialDetailView.as_view(), name='environment-credentials-detail'),
path('<uuid:pk>/reveal/', EnvironmentCredentialRevealView.as_view(), name='environment-credentials-reveal'),
]

App Config — apps/environment_credentials/apps.py

pythonfrom django.apps import AppConfig

class EnvironmentCredentialsConfig(AppConfig):
default_auto_field = 'django.db.models.BigAutoField'
name = 'apps.environment_credentials'

    def ready(self):
        import apps.environment_credentials.signals  # noqa

Admin — apps/environment_credentials/admin.py

pythonfrom django.contrib import admin

from apps.environment_credentials.models import EnvironmentCredential

@admin.register(EnvironmentCredential)
class EnvironmentCredentialAdmin(admin.ModelAdmin):
list_display = ['id', 'project', 'environment_type', 'system_name', 'updated_by', 'updated_at']
list_filter = ['environment_type', 'created_at']
search_fields = ['system_name', 'system_ip', 'project__name']
readonly_fields = ['id', 'created_at', 'updated_at']
raw_id_fields = ['project', 'updated_by']

Files Modified

config/settings/base.py

Added the new app to LOCAL_APPS:

pythonLOCAL_APPS = [
'apps.users',
'apps.authentication',
'apps.projects',
'apps.teams',
'apps.env_variables',
'apps.license_keys',
'apps.admin_credentials',
'apps.environment_credentials', # new
'apps.app_users',
'apps.activity_log',
'apps.settings_profile',
'apps.reports',
'apps.notifications',
]

apps/projects/urls.py

Added three routes for environment credentials:

pythonfrom apps.environment_credentials import views as ec_views

path(
'<uuid:project_id>/environment-credentials/',
ec_views.EnvironmentCredentialListView.as_view(),
name='environment-cred-list',
),
path(
'<uuid:project_id>/environment-credentials/<uuid:pk>/',
ec_views.EnvironmentCredentialDetailView.as_view(),
name='environment-cred-detail',
),
path(
'<uuid:project_id>/environment-credentials/<uuid:pk>/reveal/',
ec_views.EnvironmentCredentialRevealView.as_view(),
name='environment-cred-reveal',
),

API Endpoints

GET /api/v1/projects/{project_id}/environment-credentials/

Returns both Development and Deployment records with passwords masked.

json{
"success": true,
"message": "Environment credentials retrieved.",
"data": [
{
"id": "uuid",
"environment_type": "DEVELOPMENT",
"system_name": "DEV-SERVER-01",
"system_ip": "192.168.1.101",
"admin_password": "••••••••",
"rustdesk_ip": "192.168.1.102",
"rustdesk_password": "••••••••",
"updated_by": { "id": "uuid", "email": "user@example.com" },
"created_at": "2024-01-01T00:00:00Z",
"updated_at": "2024-01-15T12:30:00Z"
}
]
}

PATCH /api/v1/projects/{project_id}/environment-credentials/{id}/

Partial update. Only send the fields you want to change.

json{
"system_name": "DEV-SERVER-02",
"system_ip": "192.168.1.105",
"admin_password": "newPassword123"
}

GET /api/v1/projects/{project_id}/environment-credentials/{id}/reveal/

Returns the record with decrypted passwords. This action is logged in the activity log.

Database Schema

Table: environment_credentials

ColumnTypeNotesidUUIDPrimary keyproject_idUUIDFK to projects, CASCADE deleteenvironment_typeVARCHAR(20)DEVELOPMENT or DEPLOYMENTsystem_nameVARCHAR(255)system_ipVARCHAR(255)admin_passwordTEXTEncryptedrustdesk_ipVARCHAR(255)rustdesk_passwordTEXTEncryptedupdated_by_idUUIDFK to users, SET NULLcreated_atTIMESTAMPAutoupdated_atTIMESTAMPAuto

Unique constraint on (project_id, environment_type) prevents duplicates.

Activity Logging

All writes and reveals are logged automatically. No additional setup is needed.

When credentials are updated, a log entry is created with action UPDATED and description {DEVELOPMENT/DEPLOYMENT} environment credentials updated.

When passwords are revealed via the reveal endpoint, a log entry is created with action REVEALED. This gives a full audit trail of who accessed plaintext credentials and when.

Logs appear in the project activity log tab and in the dashboard notifications for team members.

Bug Fix — React useEffect Issue

After the backend was complete, the frontend had a bug where saving credentials would send empty data to the API.

The root cause was broken useEffect dependency arrays in CredentialsOverviewTab.tsx:

typescript// broken
useEffect(() => {
if (devCred) {
setDevTemp(devData); // devData not in dependency array
}
}, [devCred?.id]); // stale data used on every save

The fix was to remove these hooks entirely and only set temp state when the user enters edit mode by clicking Edit or Add Credentials. This guarantees the form always has fresh data.

A second fix was to the render condition — input fields were hidden when all values were empty, which is the default state for new projects. Changed from:

typescript{hasData ? <fields> : <empty state>}

to:

typescript{hasData || editMode ? <fields> : <empty state>}

All console.log and alert debug statements were removed before the final commit.

Deployment

To apply to a running Docker environment:

bashdocker compose down
docker compose up -d --build
docker compose exec backend python manage.py makemigrations environment_credentials
docker compose exec backend python manage.py migrate

To verify the migration ran:

bashdocker compose exec backend python manage.py shell -c \
 "from apps.environment_credentials.models import EnvironmentCredential; \
 print(EnvironmentCredential.objects.count())"

Frontend Integration Notes

The frontend should call GET /api/v1/projects/{project_id}/environment-credentials/ on page load and display both Development and Deployment cards with masked passwords.

When the user clicks Edit, open a form pre-filled with current non-password values. On save, call PATCH with only the changed fields — do not send unchanged password fields, as sending an empty string would overwrite the stored encrypted value.

When the user clicks the eye icon, call the reveal endpoint and temporarily display the decrypted password. Do not store the decrypted value in component state longer than needed.

Handle 401 responses by redirecting to login and 404 responses by showing a not-found message.
