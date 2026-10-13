from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('env_variables', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='envvariable',
            name='file_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='envvariable',
            name='file_data',
            field=models.TextField(blank=True, default=''),
        ),
    ]
