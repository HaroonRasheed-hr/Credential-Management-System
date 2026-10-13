import re
from django.core.validators import validate_email as _django_validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers


def validate_email_format(value: str) -> str:
    try:
        _django_validate_email(value)
    except DjangoValidationError:
        raise serializers.ValidationError('Enter a valid email address.')
    return value.lower().strip()


def validate_password_strength(value: str) -> str:
    errors = []
    if len(value) < 8:
        errors.append('Password must be at least 8 characters.')
    if not re.search(r'[A-Z]', value):
        errors.append('Password must contain at least one uppercase letter.')
    if not re.search(r'[a-z]', value):
        errors.append('Password must contain at least one lowercase letter.')
    if not re.search(r'\d', value):
        errors.append('Password must contain at least one digit.')
    if not re.search(r'[!@#$%^&*()\-_=+\[\]{};:\'",.<>?/\\|`~]', value):
        errors.append('Password must contain at least one special character.')
    if errors:
        raise serializers.ValidationError(errors)
    return value
