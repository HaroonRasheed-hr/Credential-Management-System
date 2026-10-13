from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('teams', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='team',
            name='team_type',
            field=models.CharField(
                choices=[
                    ('AI_RESEARCH', 'AI / Research'),
                    ('ENGINEERING', 'Engineering'),
                    ('ADMIN', 'Admin'),
                ],
                default='AI_RESEARCH',
                max_length=20,
            ),
        ),
    ]
