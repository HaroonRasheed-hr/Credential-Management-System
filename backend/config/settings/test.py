from .base import *  # noqa: F401, F403
from cryptography.fernet import Fernet

# Use a deterministic Fernet key for tests so encryption/decryption is stable
# across the test run without requiring FERNET_KEY in the environment.
FERNET_KEY = Fernet.generate_key().decode()

# Use in-memory cache so tests never require a running Redis instance.
# The AuthService degrades to DB-only when cache.ttl() is unavailable.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'test-cache',
    }
}

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}
