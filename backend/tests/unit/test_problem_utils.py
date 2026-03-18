"""
Unit tests for problem utility helpers.
"""

from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory

from dorso_api.apps.problems.utils import custom_exception_handler


class TestProblemUtils:
    def test_custom_exception_handler_wraps_validation_errors(self):
        request = APIRequestFactory().get('/api/v1/problems/random/')
        response = custom_exception_handler(
            ValidationError({'field': ['bad value']}),
            {'request': request},
        )

        assert response.status_code == 400
        assert response.data['error'] is True
        assert 'field' in response.data['details']

