"""
Views for tracking user behavior and sessions.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from prometheus_client import Counter, Histogram
import structlog

from .models import ExtensionUser, ProblemAttempt, AccessLog, UserSession
from .serializers import (
    ExtensionUserSerializer,
    ExtensionUserStatsSerializer,
    ProblemAttemptSerializer,
    AccessLogSerializer,
    UserSessionSerializer,
    RegisterUserSerializer,
    CheckSessionSerializer,
)

logger = structlog.get_logger(__name__)

# Prometheus metrics
user_registrations = Counter(
    'dorso_user_registrations_total',
    'Total number of extension user registrations',
    ['browser']
)
session_checks = Counter(
    'dorso_session_checks_total',
    'Total number of session status checks',
    ['has_active_session']
)
api_request_duration = Histogram(
    'dorso_api_request_duration_seconds',
    'API request duration',
    ['endpoint', 'method']
)


class ExtensionUserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing extension users.
    """
    queryset = ExtensionUser.objects.all()
    serializer_class = ExtensionUserSerializer
    lookup_field = 'extension_id'

    @action(detail=True, methods=['get'])
    def stats(self, request, extension_id=None):
        """
        Get detailed statistics for a user.
        GET /api/v1/users/{extension_id}/stats/
        """
        user = self.get_object()
        serializer = ExtensionUserStatsSerializer(user)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def attempts(self, request, extension_id=None):
        """
        Get all problem attempts for a user.
        GET /api/v1/users/{extension_id}/attempts/
        """
        user = self.get_object()
        attempts = user.attempts.all()

        # Optional filtering
        solved = request.query_params.get('solved')
        if solved is not None:
            attempts = attempts.filter(solved=solved.lower() == 'true')

        difficulty = request.query_params.get('difficulty')
        if difficulty:
            attempts = attempts.filter(difficulty__iexact=difficulty)

        serializer = ProblemAttemptSerializer(attempts, many=True)
        return Response(serializer.data)


class RegisterUserView(APIView):
    """
    Register a new extension user or update existing one.
    POST /api/v1/users/register/
    """

    def post(self, request):
        serializer = RegisterUserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user_registrations.labels(browser=user.browser).inc()

            logger.info(
                "user_registered",
                extension_id=user.extension_id,
                browser=user.browser,
            )

            response_serializer = ExtensionUserSerializer(user)
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CheckSessionView(APIView):
    """
    Check if a user has an active session.
    GET /api/v1/users/check-session/?extension_id=xxx
    """

    def get(self, request):
        extension_id = request.query_params.get('extension_id')
        if not extension_id:
            return Response(
                {'error': 'extension_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = ExtensionUser.objects.get(extension_id=extension_id)
        except ExtensionUser.DoesNotExist:
            return Response(
                {
                    'has_active_session': False,
                    'error': 'User not found. Please register first.'
                },
                status=status.HTTP_404_NOT_FOUND
            )

        session = user.get_active_session()
        has_active = session is not None

        session_checks.labels(has_active_session=str(has_active)).inc()

        response_data = {
            'has_active_session': has_active,
            'extension_id': extension_id,
        }

        if has_active:
            response_data['session_expires'] = session.session_end
            response_data['session_id'] = session.id

        logger.info(
            "session_checked",
            extension_id=extension_id,
            has_active_session=has_active,
        )

        return Response(response_data)


class LogAccessView(APIView):
    """
    Log when a user accesses an AI chatbot.
    POST /api/v1/users/log-access/
    """

    def post(self, request):
        serializer = AccessLogSerializer(data=request.data)
        if serializer.is_valid():
            access_log = serializer.save()

            logger.info(
                "chatbot_accessed",
                extension_id=access_log.user.extension_id,
                chatbot_name=access_log.chatbot_name,
                chatbot_url=access_log.chatbot_url,
            )

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
