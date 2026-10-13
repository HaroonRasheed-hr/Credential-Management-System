from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.environment_credentials.models import EnvironmentCredential
from apps.projects.models import Project


@receiver(post_save, sender=Project)
def create_default_environment_credentials(sender, instance, created, **kwargs):
    """
    Automatically create Development and Deployment environment credentials
    when a new project is created.
    """
    if created:
        # Create Development credentials
        EnvironmentCredential.objects.create(
            project=instance,
            environment_type=EnvironmentCredential.EnvironmentType.DEVELOPMENT,
            system_name='',
            system_ip='',
            admin_password='',
            rustdesk_ip='',
            rustdesk_password='',
            updated_by=instance.created_by,
        )
        
        # Create Deployment credentials
        EnvironmentCredential.objects.create(
            project=instance,
            environment_type=EnvironmentCredential.EnvironmentType.DEPLOYMENT,
            system_name='',
            system_ip='',
            admin_password='',
            rustdesk_ip='',
            rustdesk_password='',
            updated_by=instance.created_by,
        )
