import base64
import json
import logging

from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()

# Paths that don't require a valid token (public endpoints + Django admin)
_EXEMPT_PREFIXES = (
    '/api/v1/auth/login/',
    '/api/v1/auth/refresh/',
    '/admin/',
    '/static/',
)


def _decode_jwt_payload(raw_token: str) -> dict:
    """Decode JWT claims without signature verification.

    Full validation (signature, expiry, blacklist) is handled by DRF's
    JWTAuthentication on every view. This middleware only needs the claims
    to attach request.user / request.role for non-DRF code; it is not an
    authoritative auth gate.
    """
    try:
        parts = raw_token.split('.')
        if len(parts) != 3:
            return {}
        padding = '=' * (4 - len(parts[1]) % 4)
        payload_bytes = base64.urlsafe_b64decode(parts[1] + padding)
        return json.loads(payload_bytes)
    except Exception:
        return {}


class JWTAuthMiddleware:
    """
    Attaches ``request.user``, ``request.auth``, and ``request.role`` for
    downstream non-DRF code (other middleware, signals, etc.).

    This middleware complements—not replaces—DRF's JWTAuthentication class.
    DRF still performs its own per-request auth (signature check, expiry,
    blacklist) for every DRF view; that is the authoritative security gate.
    Here we only decode the payload cheaply so non-DRF layers can read the
    current user without an extra round-trip.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not self._is_exempt(request):
            self._try_authenticate(request)
        return self.get_response(request)

    @staticmethod
    def _is_exempt(request) -> bool:
        return any(request.path.startswith(prefix) for prefix in _EXEMPT_PREFIXES)

    @staticmethod
    def _try_authenticate(request) -> None:
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return

        raw_token = auth_header[len('Bearer '):].strip()
        if not raw_token:
            return

        claims = _decode_jwt_payload(raw_token)
        user_id = claims.get('user_id')
        role = claims.get('role')

        if not user_id:
            return

        try:
            user = User.objects.get(id=user_id, is_active=True)
            request.user = user
            request.auth = raw_token
            request.role = role or user.role
        except User.DoesNotExist:
            logger.debug('JWTAuthMiddleware: user not found for token user_id=%s', user_id)
        except Exception as exc:
            logger.debug('JWTAuthMiddleware: failed to attach user — %s: %s', type(exc).__name__, exc)
