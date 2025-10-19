"""
Pytest configuration and fixtures.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from dorso_api.apps.tracking.models import ExtensionUser, ProblemAttempt, UserSession
from datetime import timedelta
from django.utils import timezone


@pytest.fixture
def api_client():
    """DRF API client for testing."""
    return APIClient()


@pytest.fixture
def extension_user(db):
    """Create a test extension user."""
    return ExtensionUser.objects.create(
        extension_id='test-extension-12345',
        browser='chrome'
    )


@pytest.fixture
def extension_user_with_stats(db):
    """Create an extension user with some solve history."""
    user = ExtensionUser.objects.create(
        extension_id='test-user-with-stats',
        browser='firefox',
        total_solves=5,
        current_streak=2,
        longest_streak=3,
        total_attempts=10
    )
    return user


@pytest.fixture
def problem_attempt(db, extension_user):
    """Create a test problem attempt."""
    return ProblemAttempt.objects.create(
        user=extension_user,
        problem_slug='two-sum',
        problem_title='Two Sum',
        difficulty='Easy',
        solved=True,
        time_taken_seconds=300
    )


@pytest.fixture
def active_session(db, extension_user, problem_attempt):
    """Create an active session."""
    return UserSession.create_session(
        user=extension_user,
        problem_attempt=problem_attempt,
        duration_seconds=900  # 15 minutes
    )


@pytest.fixture
def expired_session(db, extension_user, problem_attempt):
    """Create an expired session."""
    session = UserSession.objects.create(
        user=extension_user,
        session_start=timezone.now() - timedelta(minutes=20),
        session_end=timezone.now() - timedelta(minutes=5),
        is_active=True,
        problem_attempt=problem_attempt
    )
    return session
