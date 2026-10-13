import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from utils.responses import error_response, success_response

from .serializers import ChangePasswordSerializer, ProfileSerializer, UpdateProfileSerializer

logger = logging.getLogger(__name__)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = ProfileSerializer(request.user)
        return success_response('Profile retrieved.', data=serializer.data)

    def patch(self, request):
        serializer = UpdateProfileSerializer(
            request.user, data=request.data, partial=True
        )
        if not serializer.is_valid():
            errors = serializer.errors
            if 'username' in errors:
                code = 'USERNAME_TAKEN'
            elif 'email' in errors:
                code = 'EMAIL_TAKEN'
            else:
                code = 'VALIDATION_ERROR'
            return error_response('Validation failed.', errors=errors, code=code, status=400)

        serializer.save()
        return success_response(
            'Profile updated successfully.',
            data=ProfileSerializer(request.user).data,
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={'request': request}
        )
        if not serializer.is_valid():
            errors = serializer.errors
            if 'current_password' in errors:
                code = 'INVALID_CURRENT_PASSWORD'
            elif 'confirm_password' in errors:
                code = 'PASSWORD_MISMATCH'
            elif 'non_field_errors' in errors:
                code = 'PASSWORD_SAME_AS_CURRENT'
            else:
                code = 'VALIDATION_ERROR'
            return error_response('Validation failed.', errors=errors, code=code, status=400)

        user = request.user
        try:
            user.set_password(serializer.validated_data['new_password'])
            user.save(update_fields=['password', 'updated_at'])
        except Exception as exc:
            logger.error('ChangePasswordView: failed to save password for user %s — %s', user.id, exc)
            return error_response('Failed to change password. Please try again.', status=500)

        try:
            tokens = OutstandingToken.objects.filter(user=user)
            for token in tokens:
                BlacklistedToken.objects.get_or_create(token=token)
        except Exception:
            logger.warning('Failed to blacklist tokens for user %s after password change', user.id)

        return success_response('Password changed successfully. Please log in again.')
