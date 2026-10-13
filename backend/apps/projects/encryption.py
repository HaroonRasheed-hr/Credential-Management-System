from cryptography.fernet import Fernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class EncryptionService:
    """Symmetric encryption/decryption using Fernet (AES-128-CBC + HMAC-SHA256).

    The key is sourced from ``settings.FERNET_KEY`` which must be a 32-byte
    URL-safe base64-encoded string (generate with ``Fernet.generate_key()``).
    """

    _fernet: Fernet | None = None

    @classmethod
    def _get_fernet(cls) -> Fernet:
        if cls._fernet is None:
            key = settings.FERNET_KEY
            if not key:
                raise ImproperlyConfigured(
                    'FERNET_KEY is not set. '
                    'Generate one with: '
                    'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" '
                    'and add it to your .env file.'
                )
            if isinstance(key, str):
                key = key.encode()
            cls._fernet = Fernet(key)
        return cls._fernet

    @classmethod
    def encrypt(cls, value: str) -> str:
        """Return the Fernet-encrypted ciphertext of *value*.

        Returns the empty string unchanged so that optional fields that were
        left blank are not accidentally encrypted.
        """
        if not value:
            return value
        return cls._get_fernet().encrypt(value.encode()).decode()

    @classmethod
    def decrypt(cls, value: str) -> str:
        """Return the plaintext of *value*.

        If decryption fails (e.g. the value was never encrypted or the key
        changed) the original value is returned so the application degrades
        gracefully rather than crashing.
        """
        if not value:
            return value
        try:
            return cls._get_fernet().decrypt(value.encode()).decode()
        except Exception:
            return value
