import django.contrib.auth.models
import django.db.models.deletion
import django.utils.timezone
import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(
                    default=False,
                    help_text='Designates that this user has all permissions without explicitly assigning them.',
                    verbose_name='superuser status',
                )),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('email', models.EmailField(db_index=True, max_length=254, unique=True)),
                ('username', models.CharField(max_length=150, unique=True)),
                ('role', models.CharField(
                    choices=[('ADMIN', 'Admin'), ('DEVELOPER', 'Developer')],
                    default='DEVELOPER',
                    max_length=20,
                )),
                ('failed_login_attempts', models.PositiveSmallIntegerField(default=0)),
                ('lockout_until', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('last_login_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('last_login_at', models.DateTimeField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('is_staff', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('groups', models.ManyToManyField(
                    blank=True,
                    help_text='The groups this user belongs to.',
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.group',
                    verbose_name='groups',
                )),
                ('user_permissions', models.ManyToManyField(
                    blank=True,
                    help_text='Specific permissions for this user.',
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.permission',
                    verbose_name='user permissions',
                )),
            ],
            options={
                'db_table': 'users',
                'ordering': ['-created_at'],
            },
            managers=[
                ('objects', django.contrib.auth.models.UserManager()),
            ],
        ),
    ]
