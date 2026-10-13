import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('device_credentials', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectDevice',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('project_id', models.UUIDField(db_index=True)),
                ('added_at', models.DateTimeField(auto_now_add=True)),
                ('device', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='project_assignments',
                    to='device_credentials.devicecredential',
                )),
            ],
            options={
                'db_table': 'project_device',
                'ordering': ['added_at'],
                'unique_together': {('project_id', 'device')},
            },
        ),
    ]
