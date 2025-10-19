"""
Utility functions for problems app.
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
import structlog

logger = structlog.get_logger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler for DRF.
    Adds structured logging for all exceptions.
    """
    response = exception_handler(exc, context)

    if response is not None:
        # Add custom error format
        custom_response_data = {
            'error': True,
            'message': str(exc),
            'details': response.data
        }

        logger.error(
            "api_exception",
            exception_type=type(exc).__name__,
            message=str(exc),
            status_code=response.status_code,
            path=context['request'].path,
        )

        response.data = custom_response_data

    return response
