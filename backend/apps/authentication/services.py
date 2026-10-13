import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()
logger = logging.getLogger(__name__)

MAX_ATTEMPTS: int = getattr(settings, 'LOGIN_MAX_ATTEMPTS', 3)
LOCKOUT_DURATION: int = getattr(settings, 'LOGIN_LOCKOUT_DURATION', 300)

_ATTEMPTS_KEY = 'login_attempts:{email}'
_LOCKOUT_KEY = 'login_lockout:{email}'


# ── Custom exceptions ──────────────────────────────────────────────────────────

class AuthenticationError(Exception):
    def __init__(self, message: str, code: str = 'auth_error'):
        self.message = message
        self.code = code
        super().__init__(message)


class AccountLockedError(AuthenticationError):
    def __init__(self, message: str, remaining_seconds: int = 0):
        self.remaining_seconds = remaining_seconds
        super().__init__(message, code='account_locked')


class InvalidCredentialsError(AuthenticationError):
    def __init__(self, message: str, attempts_remaining: int = 0):
        self.attempts_remaining = attempts_remaining
        super().__init__(message, code='invalid_credentials')


# ── Service ────────────────────────────────────────────────────────────────────

class AuthService:

    # ── Redis helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _attempts_key(email: str) -> str:
        return _ATTEMPTS_KEY.format(email=email.lower())

    @staticmethod
    def _lockout_key(email: str) -> str:
        return _LOCKOUT_KEY.format(email=email.lower())

    @staticmethod
    def _cache_ttl(key: str) -> int:
        """Return remaining TTL in seconds; 0 if unavailable or not set."""
        try:
            ttl = cache.ttl(key)
            return int(ttl) if ttl and ttl > 0 else 0
        except AttributeError:
            # LocMemCache used in tests doesn't implement ttl()
            return 0

    # ── Lockout checks ─────────────────────────────────────────────────────────

    @classmethod
    def is_account_locked(cls, email: str) -> bool:
        # Fast path: Redis
        if cache.get(cls._lockout_key(email)):
            return True

        # Fallback: database (also re-syncs Redis when Redis was temporarily down)
        try:
            user = User.objects.only('lockout_until').get(email__iexact=email)
            if user.lockout_until and user.lockout_until > timezone.now():
                remaining = int((user.lockout_until - timezone.now()).total_seconds())
                cache.set(cls._lockout_key(email), True, timeout=remaining)
                return True
        except User.DoesNotExist:
            pass

        return False

    @classmethod
    def get_lockout_remaining(cls, email: str) -> int:
        ttl = cls._cache_ttl(cls._lockout_key(email))
        if ttl:
            return ttl
        try:
            user = User.objects.only('lockout_until').get(email__iexact=email)
            if user.lockout_until and user.lockout_until > timezone.now():
                return int((user.lockout_until - timezone.now()).total_seconds())
        except User.DoesNotExist:
            pass
        return 0

    # ── Attempt tracking ───────────────────────────────────────────────────────

    @classmethod
    def record_failed_attempt(cls, email: str) -> int:
        """Increment attempt counter; lock account if threshold is reached. Returns new count."""
        key = cls._attempts_key(email)
        current = cache.get(key, 0)
        new_count = current + 1
        cache.set(key, new_count, timeout=LOCKOUT_DURATION)

        # Mirror to database
        try:
            user = User.objects.get(email__iexact=email)
            user.failed_login_attempts = new_count
            fields_to_save = ['failed_login_attempts']

            if new_count >= MAX_ATTEMPTS:
                lockout_until = timezone.now() + timedelta(seconds=LOCKOUT_DURATION)
                user.lockout_until = lockout_until
                fields_to_save.append('lockout_until')
                cache.set(cls._lockout_key(email), True, timeout=LOCKOUT_DURATION)
                logger.warning(
                    'Account locked: %s after %d failed attempts', email, new_count
                )

            user.save(update_fields=fields_to_save)
        except User.DoesNotExist:
            pass

        return new_count

    @classmethod
    def clear_failed_attempts(cls, email: str) -> None:
        """Reset attempt counter and lockout state after a successful login."""
        # Single round-trip instead of two — matters when Redis is slow/unreachable.
        cache.delete_many([cls._attempts_key(email), cls._lockout_key(email)])

        try:
            user = User.objects.get(email__iexact=email)
            user.failed_login_attempts = 0
            user.lockout_until = None
            user.save(update_fields=['failed_login_attempts', 'lockout_until'])
        except User.DoesNotExist:
            pass

    # ── Core authenticate ──────────────────────────────────────────────────────

    @classmethod
    def authenticate(cls, email: str, password: str, ip_address: str | None = None) -> dict:
        """
        Validate credentials and return JWT token pair + user summary.

        Raises:
            AccountLockedError: when the account is locked.
            InvalidCredentialsError: for bad email or password.
        """
        email = email.lower().strip()

        if cls.is_account_locked(email):
            remaining = cls.get_lockout_remaining(email)
            raise AccountLockedError(
                f'Account locked. Try again in {remaining} seconds.',
                remaining_seconds=remaining,
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Constant-time-ish: still record attempt even for unknown emails to
            # prevent enumeration-by-timing. The counter is stored under the email
            # key so it won't affect real accounts.
            cls.record_failed_attempt(email)
            raise InvalidCredentialsError('Invalid credentials.')

        if not user.is_active:
            raise InvalidCredentialsError('This account has been disabled.')

        if not user.check_password(password):
            count = cls.record_failed_attempt(email)
            remaining_attempts = max(0, MAX_ATTEMPTS - count)
            if remaining_attempts == 0:
                remaining_seconds = cls.get_lockout_remaining(email)
                raise AccountLockedError(
                    f'Account locked for {LOCKOUT_DURATION // 60} minutes due to too many '
                    f'failed login attempts.',
                    remaining_seconds=remaining_seconds,
                )
            raise InvalidCredentialsError(
                f'Invalid credentials. {remaining_attempts} attempt(s) remaining before lockout.',
                attempts_remaining=remaining_attempts,
            )

        # ── Success path ───────────────────────────────────────────────────────
        cls.clear_failed_attempts(email)

        now = timezone.now()
        update_fields = ['last_login_at', 'last_login']
        user.last_login_at = now
        user.last_login = now
        if ip_address:
            user.last_login_ip = ip_address
            update_fields.append('last_login_ip')
        user.save(update_fields=update_fields)

        refresh = RefreshToken.for_user(user)
        # Embed role so downstream middleware/services can read it without a DB hit
        refresh['role'] = user.role
        refresh['email'] = user.email
        refresh['username'] = user.username

        logger.info('Successful login: %s from %s', email, ip_address or 'unknown')

        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': str(user.id),
                'email': user.email,
                'username': user.username,
                'role': user.role,
            },
        }

    # ── Logout ─────────────────────────────────────────────────────────────────

    @staticmethod
    def logout(refresh_token: str) -> None:
        """Blacklist the supplied refresh token."""
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError as exc:
            raise AuthenticationError(str(exc), code='token_invalid') from exc

    # ── Utilities ──────────────────────────────────────────────────────────────

    @staticmethod
    def get_client_ip(request) -> str:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')
