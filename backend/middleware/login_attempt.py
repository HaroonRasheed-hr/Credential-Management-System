import json
import logging

from django.conf import settings
from django.core.cache import cache
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

logger = logging.getLogger(__name__)

_LOGIN_PATH = '/api/v1/auth/login/'
_MAX_ATTEMPTS: int = getattr(settings, 'LOGIN_MAX_ATTEMPTS', 3)
_LOCKOUT_DURATION: int = getattr(settings, 'LOGIN_LOCKOUT_DURATION', 300)


class LoginAttemptMiddleware:
    """
    Intercepts POST requests to the login endpoint and short-circuits with a
    423 response if the account is already locked in Redis.

    This is a fast-path guard that acts *before* the view layer. The view's
    AuthService still performs its own lockout check as the authoritative gate.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == _LOGIN_PATH and request.method == 'POST':
            block_response = self._check_lockout(request)
            if block_response is not None:
                return block_response
        return self.get_response(request)

    def _check_lockout(self, request) -> Response | None:
        email = self._extract_email(request)
        if not email:
            return None

        lockout_key = f'login_lockout:{email}'
        if not cache.get(lockout_key):
            return None

        remaining = self._get_remaining_seconds(lockout_key)
        logger.warning('LoginAttemptMiddleware blocked locked account: %s', email)
        response = Response(
            {
                'success': False,
                'message': f'Account locked. Try again in {remaining} seconds.',
                'code': 'account_locked',
                'retry_after': remaining,
            },
            status=423,
        )
        response.accepted_renderer = JSONRenderer()
        response.accepted_media_type = 'application/json'
        response.renderer_context = {}
        response.render()
        return response

    @staticmethod
    def _get_remaining_seconds(key: str) -> int:
        try:
            ttl = cache.ttl(key)
            return int(ttl) if ttl and ttl > 0 else _LOCKOUT_DURATION
        except AttributeError:
            return _LOCKOUT_DURATION

    @staticmethod
    def _extract_email(request) -> str | None:
        content_type = request.content_type or ''
        if 'application/json' in content_type:
            try:
                body = json.loads(request.body)
                email = body.get('email', '')
                return email.strip().lower() if email else None
            except (json.JSONDecodeError, AttributeError):
                return None

        email = request.POST.get('email', '').strip().lower()
        return email or None
