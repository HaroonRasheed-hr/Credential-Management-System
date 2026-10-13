# Generated for ActivityLog.Action 'ADDED' choice

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('activity_log', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='activitylog',
            name='action',
            field=models.CharField(
                choices=[
                    ('CREATED', 'Created'),
                    ('ADDED', 'Added'),
                    ('UPDATED', 'Updated'),
                    ('DELETED', 'Deleted'),
                    ('REVEALED', 'Revealed'),
                ],
                max_length=20,
            ),
        ),
    ]
