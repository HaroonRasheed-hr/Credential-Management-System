import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Team',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_teams',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'teams',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TeamMember',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('role', models.CharField(
                    choices=[('ADMIN', 'Admin'), ('DEVELOPER', 'Developer')],
                    default='DEVELOPER',
                    max_length=20,
                )),
                ('added_at', models.DateTimeField(auto_now_add=True)),
                ('added_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='added_team_members',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('team', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='members',
                    to='teams.team',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='team_memberships',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'team_members',
                'unique_together': {('team', 'user')},
            },
        ),
    ]
