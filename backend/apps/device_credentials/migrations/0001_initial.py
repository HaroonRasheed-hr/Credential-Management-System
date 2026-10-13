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
            name='DeviceCredential',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('device_name', models.CharField(max_length=255)),
                ('device_ip', models.CharField(blank=True, max_length=255)),
                ('rustdesk_ip', models.CharField(blank=True, max_length=255)),
                ('rustdesk_password', models.TextField(blank=True)),
                ('sudo_password', models.TextField(blank=True)),
                ('device_password', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='device_credentials',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'device_credentials',
                'ordering': ['-created_at'],
            },
        ),
    ]
