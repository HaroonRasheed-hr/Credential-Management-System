import os
from datetime import timedelta
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me-in-production')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*').split(',')

DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
]

LOCAL_APPS = [
    'apps.users',
    'apps.authentication',
    'apps.projects',
    'apps.teams',
    'apps.env_variables',
    'apps.license_keys',
    'apps.admin_credentials',
    'apps.environment_credentials',
    'apps.app_users',
    'apps.activity_log',
    'apps.settings_profile',
    'apps.reports',
    'apps.notifications',
    'apps.device_credentials',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',       # must be before CommonMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    # CsrfViewMiddleware is omitted: this backend uses JWT Bearer tokens,
    # not session cookies, so CSRF attacks are not applicable.
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'middleware.request_logger.RequestLoggerMiddleware',
    'middleware.login_attempt.LoginAttemptMiddleware',
    'middleware.jwt_auth.JWTAuthMiddleware',
]

# ── Debug Toolbar (local development only) ──────────────────────────────────────
# Activated only when DEBUG=True *and* the package is importable. It's a dev-only
# dependency (see requirements.txt) and is absent from the production image, so the
# guard keeps production untouched. Surfaces SQL / N+1 query counts locally.
# NOTE: to render its full UI you must also add debug_toolbar's URLs to
# config/urls.py (out of scope here) — e.g.
#   if settings.DEBUG:
#       urlpatterns += [path('__debug__/', include('debug_toolbar.urls'))]
if DEBUG:
    try:
        import debug_toolbar  # noqa: F401
    except ImportError:
        pass
    else:
        INSTALLED_APPS += ['debug_toolbar']
        MIDDLEWARE.insert(0, 'debug_toolbar.middleware.DebugToolbarMiddleware')
        INTERNAL_IPS = ['127.0.0.1', 'localhost']

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ── Database Configuration ────────────────────────────────────────────────────
# Check for Docker/Production DATABASE_URL first, then fallback to SQLite
if 'DATABASE_URL' in os.environ:
    # Parse PostgreSQL URL: postgresql://user:password@host:port/dbname
    from urllib.parse import urlparse
    db_url = urlparse(os.environ['DATABASE_URL'])
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': db_url.path.lstrip('/'),
            'USER': db_url.username,
            'PASSWORD': db_url.password,
            'HOST': db_url.hostname,
            'PORT': db_url.port or 5432,
            'CONN_MAX_AGE': 600,
            'CONN_HEALTH_CHECKS': True,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'users.User'

# ── Encryption ────────────────────────────────────────────────────────────────
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FERNET_KEY = config('FERNET_KEY', default='')

# ── Redis ──────────────────────────────────────────────────────────────────────
REDIS_URL = config('REDIS_URL', default='redis://127.0.0.1:6379/0')

# When Redis is unreachable, every cache call blocks for the full connect timeout
# before django-redis degrades (IGNORE_EXCEPTIONS). The login path makes several
# cache calls, so a 1s timeout turned a down/blipping Redis into multi-second logins.
# 0.2s still gives a healthy local/VPC Redis (~sub-ms latency) 200x of headroom while
# making the unreachable-Redis path fail fast. Raise REDIS_CONNECT_TIMEOUT if Redis
# lives across a high-latency link.
REDIS_CONNECT_TIMEOUT = config('REDIS_CONNECT_TIMEOUT', default=0.2, cast=float)

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SOCKET_CONNECT_TIMEOUT': REDIS_CONNECT_TIMEOUT,  # fast-fail when Redis is down
            'SOCKET_TIMEOUT': REDIS_CONNECT_TIMEOUT,          # same rationale for read/write
            'RETRY_ON_TIMEOUT': False,
            'IGNORE_EXCEPTIONS': True,    # degrade gracefully if Redis is unreachable
        },
        'KEY_PREFIX': 'xisai',
    }
}

# ── Django REST Framework ──────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'utils.throttle.LocalAnonRateThrottle',
        'utils.throttle.LocalUserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/minute',
        'user': '100/minute',
        'login': '5/minute',
    },
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'EXCEPTION_HANDLER': 'utils.responses.custom_exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
}

# ── Simple JWT ─────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(
        minutes=config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=60, cast=int)
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)
    ),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': config('JWT_SIGNING_KEY', default=SECRET_KEY),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# ── CORS ──────────────────────────────────────────────────────────────────────
_cors_default = 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000'
_cors_from_env = config('CORS_ALLOWED_ORIGINS', default=_cors_default)
# Remove duplicates while preserving order
_cors_list = []
for origin in _cors_from_env.split(','):
    origin = origin.strip()
    if origin and origin not in _cors_list:
        _cors_list.append(origin)
CORS_ALLOWED_ORIGINS = _cors_list

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = [
    'accept',
    'authorization',
    'content-type',
    'x-requested-with',
]

# ── Account Lockout ────────────────────────────────────────────────────────────
LOGIN_MAX_ATTEMPTS = 3
LOGIN_LOCKOUT_DURATION = 300  # 5 minutes in seconds

# ── Logging ────────────────────────────────────────────────────────────────────
LOGS_DIR = os.path.join(BASE_DIR, 'logs')
os.makedirs(LOGS_DIR, exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'detailed': {
            'format': '[{levelname}] {asctime} | {name} | {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'detailed',
        },
        'file': {
            # Rotate at midnight and keep 14 days of history so logs/django.txt
            # can't grow unbounded. Rotated files are suffixed django.txt.YYYY-MM-DD.
            # OPS DECISION: if retention is managed by disk size rather than age,
            # swap this for a size-based rotator, e.g.
            #   'class': 'logging.handlers.RotatingFileHandler',
            #   'maxBytes': 50 * 1024 * 1024,  # 50 MB
            #   'backupCount': 5,
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'django.txt'),
            'when': 'midnight',
            'backupCount': 14,
            'encoding': 'utf-8',
            'delay': False,
            'formatter': 'detailed',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console', 'file'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.server': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'middleware.request_logger': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.authentication.services': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
