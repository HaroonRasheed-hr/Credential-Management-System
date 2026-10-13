import re

from django.core.exceptions import ValidationError


def validate_env_key(value: str) -> None:
    """Env var key must be uppercase letters, digits, and underscores only,
    and must start with an uppercase letter.

    Examples of valid keys: ``DATABASE_URL``, ``AWS_SECRET_KEY``, ``PORT``
    """
    if not re.match(r'^[A-Z][A-Z0-9_]*$', value):
        raise ValidationError(
            'Key must start with an uppercase letter and contain only '
            'uppercase letters, digits, and underscores.'
        )


def validate_url(value: str) -> None:
    """URL must begin with ``http://`` or ``https://``."""
    if not (value.startswith('http://') or value.startswith('https://')):
        raise ValidationError('URL must start with http:// or https://.')
