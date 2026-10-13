import json
import logging
import time

logger = logging.getLogger(__name__)

# Fields whose values must never appear in logs
_SENSITIVE_FIELDS = frozenset({
    'password',
    'token',
    'access',
    'refresh',
    'secret',
    'key',
    'api_key',
    'authorization',
    'credential',
})


class RequestLoggerMiddleware:
    """
    Logs every inbound request and its response (method, path, status, duration).
    Sensitive field values are replaced with *** before logging.
    Passwords are NEVER logged under any circumstances.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        self._log_request(request)

        response = self.get_response(request)

        duration_ms = (time.monotonic() - start) * 1000
        self._log_response(request, response, duration_ms)

        return response

    def _log_request(self, request) -> None:
        user = getattr(request, 'user', None)
        user_id = str(user.id) if user and getattr(user, 'is_authenticated', False) else 'anonymous'

        logger.info(
            'REQUEST  %s %s | user=%s | ip=%s | body=%s',
            request.method,
            request.path,
            user_id,
            self._get_client_ip(request),
            self._safe_body_repr(request),
        )

    @staticmethod
    def _log_response(request, response, duration_ms: float) -> None:
        logger.info(
            'RESPONSE %s %s | status=%d | %.1fms',
            request.method,
            request.path,
            response.status_code,
            duration_ms,
        )

    @staticmethod
    def _safe_body_repr(request) -> str:
        """Return a sanitized string representation of the request body."""
        content_type = request.content_type or ''
        if 'application/json' not in content_type:
            return '[non-json]'
        try:
            body: dict = json.loads(request.body)
            sanitized = {
                k: '***' if k.lower() in _SENSITIVE_FIELDS else v
                for k, v in body.items()
            }
            return str(sanitized)
        except (json.JSONDecodeError, AttributeError):
            return '[unparseable]'

    @staticmethod
    def _get_client_ip(request) -> str:
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if forwarded:
            return forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')
