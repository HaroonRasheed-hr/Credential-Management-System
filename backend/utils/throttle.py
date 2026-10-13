from django.core.cache.backends.locmem import LocMemCache
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

# Dedicated in-process cache so throttle checks never touch Redis.
# Trade-off: limits are per-worker process, not shared across workers.
# For distributed rate-limiting in production, point this at Redis when
# Redis is reliably available.
_throttle_cache = LocMemCache('throttle', {})


class LocalAnonRateThrottle(AnonRateThrottle):
    cache = _throttle_cache


class LocalUserRateThrottle(UserRateThrottle):
    cache = _throttle_cache
