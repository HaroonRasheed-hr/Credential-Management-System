from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def success_response(
    message: str,
    data=None,
    status: int = 200,
) -> Response:
    payload: dict = {'success': True, 'message': message}
    if data is not None:
        payload['data'] = data
    return Response(payload, status=status)


def error_response(
    message: str,
    errors=None,
    code: str | None = None,
    extra: dict | None = None,
    status: int = 400,
) -> Response:
    payload: dict = {'success': False, 'message': message}
    if code:
        payload['code'] = code
    if errors is not None:
        payload['errors'] = errors
    if extra:
        payload.update(extra)
    return Response(payload, status=status)


def paginated_success_response(
    paginator: PageNumberPagination,
    serializer_data,
    message: str,
) -> Response:
    """Wrap a DRF paginator result in the project's {success, data} envelope."""
    return Response(
        {
            'success': True,
            'message': message,
            'data': {
                'count': paginator.page.paginator.count,
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'results': serializer_data,
            },
        }
    )


def custom_exception_handler(exc, context) -> Response | None:
    """Wrap DRF's default exception handler in the project's envelope format."""
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    return Response(
        {
            'success': False,
            'message': 'An error occurred.',
            'errors': response.data,
        },
        status=response.status_code,
    )
