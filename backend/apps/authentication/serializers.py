from rest_framework import serializers
from django.contrib.auth import get_user_model
from .validators import validate_email_format

User = get_user_model()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={'input_type': 'password'},
    )

    def validate_email(self, value: str) -> str:
        return validate_email_format(value)


class TokenRefreshInputSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class UserProfileSerializer(serializers.ModelSerializer):
    # Declared explicitly to avoid ModelSerializer auto-mapping the model's
    # GenericIPAddressField to serializers.IPAddressField. DRF 3.14's
    # IPAddressField.__init__ unpacks ip_address_validators() into a
    # (validators, error_message) tuple, but Django 6.0 changed that helper to
    # return only the validators list — which raises ValueError at field build
    # time and 500s this endpoint. It's read-only output, so a CharField yields
    # the identical serialized value. Do NOT remove this override.
    last_login_ip = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'role',
            'last_login_at',
            'last_login_ip',
            'created_at',
        ]
        read_only_fields = fields
