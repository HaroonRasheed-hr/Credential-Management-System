import logging

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenRefreshView as _BaseTokenRefreshView

from utils.responses import error_response, success_response

from .serializers import LogoutSerializer, LoginSerializer, UserProfileSerializer
from .services import (
    AccountLockedError,
    AuthenticationError,
    AuthService,
    InvalidCredentialsError,
)

logger = logging.getLogger(__name__)


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class LoginView(APIView):
    """
    POST /api/v1/auth/login/

    Public endpoint. Returns JWT access + refresh tokens on success.
    Enforces per-account lockout after LOGIN_MAX_ATTEMPTS failures.
    """

    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        ip = AuthService.get_client_ip(request)

        try:
            tokens = AuthService.authenticate(email=email, password=password, ip_address=ip)
            return success_response('Login successful.', data=tokens, status=200)
        except AccountLockedError as exc:
            return error_response(
                exc.message,
                code=exc.code,
                extra={'retry_after': exc.remaining_seconds},
                status=423,
            )
        except InvalidCredentialsError as exc:
            return error_response(exc.message, code=exc.code, status=401)
        except AuthenticationError as exc:
            return error_response(exc.message, code=exc.code, status=401)
        except Exception:
            logger.exception('Unexpected error during login for %s', email)
            return error_response('An unexpected error occurred.', status=500)


class TokenRefreshAPIView(_BaseTokenRefreshView):
    """
    POST /api/v1/auth/refresh/

    Public endpoint. Rotates refresh token and issues a new access token.
    """

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            return success_response('Token refreshed.', data=response.data, status=200)
        return error_response('Token refresh failed.', errors=response.data, status=response.status_code)


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/

    Authenticated. Blacklists the supplied refresh token.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Validation failed.', errors=serializer.errors, status=400)

        try:
            AuthService.logout(serializer.validated_data['refresh'])
            return success_response('Logged out successfully.', status=200)
        except AuthenticationError as exc:
            return error_response(exc.message, code=exc.code, status=400)
        except Exception:
            logger.exception('Unexpected error during logout')
            return error_response('An unexpected error occurred.', status=500)


class MeView(APIView):
    """
    GET /api/v1/auth/me/

    Authenticated. Returns the profile of the currently authenticated user.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return success_response('User profile retrieved.', data=serializer.data, status=200)
