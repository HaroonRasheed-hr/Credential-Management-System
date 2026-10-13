import re

from django.core.exceptions import ValidationError


def validate_password_strength(password: str) -> None:
    """Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character."""
    if len(password) < 8:
        raise ValidationError('Password must be at least 8 characters long.')
    if not re.search(r'[A-Z]', password):
        raise ValidationError('Password must contain at least one uppercase letter.')
    if not re.search(r'[a-z]', password):
        raise ValidationError('Password must contain at least one lowercase letter.')
    if not re.search(r'\d', password):
        raise ValidationError('Password must contain at least one digit.')
    if not re.search(r'[^a-zA-Z0-9]', password):
        raise ValidationError('Password must contain at least one special character.')


def validate_username_format(username: str) -> None:
    """Letters, digits, hyphens, underscores only. Min 3, max 150 chars."""
    if len(username) < 3:
        raise ValidationError('Username must be at least 3 characters long.')
    if len(username) > 150:
        raise ValidationError('Username must be at most 150 characters long.')
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        raise ValidationError(
            'Username may only contain letters, digits, hyphens, and underscores.'
        )


def validate_new_not_same_as_current(new_password: str, user) -> None:
    """Raise ValidationError if new password matches the current one."""
    if user.check_password(new_password):
        raise ValidationError(
            'New password must be different from your current password.',
            code='PASSWORD_SAME_AS_CURRENT',
        )
