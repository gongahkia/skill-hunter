"""
Unit tests for Django models.
"""

import pytest
from django.utils import timezone
from datetime import timedelta
from dorso_api.apps.tracking.models import (
    ExtensionUser,
    ProblemAttempt,
    UserSession,
    AccessLog
)


@pytest.mark.django_db
class TestExtensionUserModel:
    """Test ExtensionUser model."""

    def test_create_extension_user(self):
        """Test creating an extension user."""
        user = ExtensionUser.objects.create(
            extension_id='test-123',
            browser='chrome'
        )
        assert user.extension_id == 'test-123'
        assert user.browser == 'chrome'
        assert user.total_solves == 0
        assert user.current_streak == 0
        assert user.is_active is True

    def test_record_solve_increments_stats(self, extension_user):
        """Test that record_solve updates user statistics."""
        initial_solves = extension_user.total_solves
        extension_user.record_solve()

        assert extension_user.total_solves == initial_solves + 1
        assert extension_user.current_streak == 1

    def test_record_solve_updates_streak(self, extension_user):
        """Test streak logic when solving problems."""
        # First solve
        solve_time_1 = timezone.now() - timedelta(hours=12)
        extension_user.record_solve(solve_time_1)
        assert extension_user.current_streak == 1

        # Second solve within 24 hours - streak continues
        solve_time_2 = timezone.now()
        extension_user.record_solve(solve_time_2)
        assert extension_user.current_streak == 2
        assert extension_user.longest_streak == 2

    def test_has_active_session(self, extension_user, active_session):
        """Test checking for active session."""
        assert extension_user.has_active_session() is True

    def test_no_active_session(self, extension_user):
        """Test when user has no active session."""
        assert extension_user.has_active_session() is False

    def test_str_representation(self, extension_user):
        """Test string representation."""
        assert 'chrome' in str(extension_user)
        assert '0 solves' in str(extension_user)


@pytest.mark.django_db
class TestProblemAttemptModel:
    """Test ProblemAttempt model."""

    def test_create_problem_attempt(self, extension_user):
        """Test creating a problem attempt."""
        attempt = ProblemAttempt.objects.create(
            user=extension_user,
            problem_slug='two-sum',
            problem_title='Two Sum',
            difficulty='Easy',
            solved=False
        )
        assert attempt.problem_slug == 'two-sum'
        assert attempt.solved is False
        assert attempt.user == extension_user

    def test_solved_attempt(self, problem_attempt):
        """Test a solved problem attempt."""
        assert problem_attempt.solved is True
        assert problem_attempt.time_taken_seconds == 300

    def test_str_representation(self, problem_attempt):
        """Test string representation."""
        assert 'Two Sum' in str(problem_attempt)
        assert 'Easy' in str(problem_attempt)


@pytest.mark.django_db
class TestUserSessionModel:
    """Test UserSession model."""

    def test_create_session(self, extension_user, problem_attempt):
        """Test creating a user session."""
        session = UserSession.create_session(
            user=extension_user,
            problem_attempt=problem_attempt,
            duration_seconds=900
        )
        assert session.user == extension_user
        assert session.is_active is True
        assert not session.is_expired()

    def test_expired_session(self, expired_session):
        """Test checking if session is expired."""
        assert expired_session.is_expired() is True

    def test_deactivate_session(self, active_session):
        """Test deactivating a session."""
        active_session.deactivate()
        assert active_session.is_active is False

    def test_create_session_deactivates_existing(self, extension_user, problem_attempt):
        """Test that creating new session deactivates old ones."""
        # Create first session
        session1 = UserSession.create_session(
            user=extension_user,
            problem_attempt=problem_attempt
        )

        # Create second session
        session2 = UserSession.create_session(
            user=extension_user,
            problem_attempt=problem_attempt
        )

        # Refresh from DB
        session1.refresh_from_db()

        assert session1.is_active is False
        assert session2.is_active is True


@pytest.mark.django_db
class TestAccessLogModel:
    """Test AccessLog model."""

    def test_create_access_log(self, extension_user, problem_attempt):
        """Test creating an access log."""
        log = AccessLog.objects.create(
            user=extension_user,
            chatbot_url='https://chatgpt.com/',
            chatbot_name='ChatGPT',
            problem_solved_for_access=problem_attempt
        )
        assert log.chatbot_name == 'ChatGPT'
        assert log.user == extension_user
        assert log.problem_solved_for_access == problem_attempt

    def test_str_representation(self, extension_user):
        """Test string representation."""
        log = AccessLog.objects.create(
            user=extension_user,
            chatbot_url='https://claude.ai/',
            chatbot_name='Claude'
        )
        assert 'Claude' in str(log)
