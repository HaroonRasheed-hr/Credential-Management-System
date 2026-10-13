from django.apps import AppConfig


class EnvironmentCredentialsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.environment_credentials'

    def ready(self):
        import apps.environment_credentials.signals  # noqa
