# Retain activity logs when their project is deleted.
#
# - Adds a denormalized ``project_name`` column so a log still records which
#   project it belonged to once the project itself is gone.
# - Changes the ``project`` FK from CASCADE to SET_NULL so deleting a project
#   nulls the reference instead of deleting the log rows.
# - Backfills ``project_name`` for any logs that already exist.

from django.db import migrations, models
import django.db.models.deletion


def backfill_project_name(apps, schema_editor):
    ActivityLog = apps.get_model('activity_log', 'ActivityLog')
    for log in ActivityLog.objects.select_related('project').filter(project__isnull=False):
        if not log.project_name:
            log.project_name = log.project.name
            log.save(update_fields=['project_name'])


class Migration(migrations.Migration):

    dependencies = [
        ('activity_log', '0002_alter_activitylog_action'),
    ]

    operations = [
        migrations.AddField(
            model_name='activitylog',
            name='project_name',
            field=models.CharField(blank=True, default='', max_length=255),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='activitylog',
            name='project',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='activity_logs',
                to='projects.project',
            ),
        ),
        migrations.RunPython(backfill_project_name, migrations.RunPython.noop),
    ]
