"""
Integration tests for Django REST API endpoints.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from dorso_api.apps.tracking.models import ExtensionUser, ProblemAttempt


@pytest.mark.django_db
class TestUserRegistrationAPI:
    """Test user registration endpoint."""

    def test_register_new_user(self, api_client):
        """Test registering a new extension user."""
        url = reverse('register')
        data = {
            'extension_id': 'new-test-extension',
            'browser': 'chrome'
        }

        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['extension_id'] == 'new-test-extension'
        assert response.data['browser'] == 'chrome'

        # Verify user was created in database
        user = ExtensionUser.objects.get(extension_id='new-test-extension')
        assert user is not None

    def test_register_existing_user_updates(self, api_client, extension_user):
        """Test registering an existing user updates last_active."""
        url = reverse('register')
        data = {
            'extension_id': extension_user.extension_id,
            'browser': 'chrome'
        }

        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert ExtensionUser.objects.filter(
            extension_id=extension_user.extension_id
        ).count() == 1


@pytest.mark.django_db
class TestSessionCheckAPI:
    """Test session checking endpoint."""

    def test_check_active_session(self, api_client, extension_user, active_session):
        """Test checking for an active session."""
        url = reverse('check-session')
        response = api_client.get(
            url,
            {'extension_id': extension_user.extension_id}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_active_session'] is True
        assert 'session_expires' in response.data

    def test_check_no_active_session(self, api_client, extension_user):
        """Test when user has no active session."""
        url = reverse('check-session')
        response = api_client.get(
            url,
            {'extension_id': extension_user.extension_id}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_active_session'] is False

    def test_check_session_missing_extension_id(self, api_client):
        """Test session check without extension_id parameter."""
        url = reverse('check-session')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_check_session_nonexistent_user(self, api_client):
        """Test session check for non-existent user."""
        url = reverse('check-session')
        response = api_client.get(
            url,
            {'extension_id': 'nonexistent-id'}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestProblemSubmissionAPI:
    """Test problem submission endpoint."""

    def test_submit_solved_problem(self, api_client, extension_user):
        """Test submitting a successfully solved problem."""
        url = reverse('submit-solution')
        data = {
            'extension_id': extension_user.extension_id,
            'problem_slug': 'two-sum',
            'problem_title': 'Two Sum',
            'difficulty': 'Easy',
            'time_taken_seconds': 300
        }

        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['success'] is True
        assert 'session_expires' in response.data

        # Verify problem attempt was created
        attempt = ProblemAttempt.objects.get(
            user=extension_user,
            problem_slug='two-sum'
        )
        assert attempt.solved is True
        assert attempt.time_taken_seconds == 300

        # Verify session was created
        assert extension_user.has_active_session() is True

        # Verify user stats were updated
        extension_user.refresh_from_db()
        assert extension_user.total_solves == 1
        assert extension_user.total_attempts == 1

    def test_submit_problem_invalid_user(self, api_client):
        """Test submitting problem with invalid user."""
        url = reverse('submit-solution')
        data = {
            'extension_id': 'invalid-user',
            'problem_slug': 'two-sum',
            'problem_title': 'Two Sum',
            'difficulty': 'Easy'
        }

        response = api_client.post(url, data, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestRandomProblemAPI:
    """Test random problem endpoint."""

    def test_get_random_problem(self, api_client, mocker):
        """Test getting a random problem."""
        # Mock LeetCode service to avoid actual API calls
        mock_problem = {
            'source': 'leetcode',
            'source_label': 'LeetCode',
            'challenge_id': '1',
            'title': 'Two Sum',
            'slug': 'two-sum',
            'url': 'https://leetcode.com/problems/two-sum/description/',
            'content': '<p>Test problem</p>',
            'difficulty': 'Easy',
            'topic_tags': ['Array', 'Hash Table'],
            'selection_mode': 'matched',
            'supports_verification': True,
            'example_testcases': '[]'
        }

        mocker.patch(
            'dorso_api.apps.problems.views.ChallengeSelectionService.get_random_problem',
            return_value=mock_problem
        )

        url = reverse('random-problem')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == 'Two Sum'
        assert response.data['difficulty'] == 'Easy'
        assert response.data['source'] == 'leetcode'
        assert response.data['selection_mode'] == 'matched'


@pytest.mark.django_db
class TestUserStatsAPI:
    """Test user statistics endpoint."""

    def test_get_user_stats(self, api_client, extension_user_with_stats):
        """Test retrieving user statistics."""
        url = reverse(
            'users-stats',
            kwargs={'extension_id': extension_user_with_stats.extension_id}
        )
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_solves'] == 5
        assert response.data['current_streak'] == 2
        assert response.data['longest_streak'] == 3
        assert 'solve_rate' in response.data
        assert 'preferences' in response.data
        assert 'source_mix' in response.data


@pytest.mark.django_db
class TestPreferencesAndIdentitiesAPI:
    """Test preference and identity endpoints."""

    def test_update_preferences(self, api_client, extension_user):
        """Test updating source and difficulty preferences."""
        url = reverse(
            'user-preferences',
            kwargs={'extension_id': extension_user.extension_id}
        )
        response = api_client.patch(url, {
            'preferred_difficulties': ['Easy', 'Medium'],
            'preferred_topics': ['Array', 'Graph'],
            'enabled_verified_sources': ['leetcode'],
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['preferred_difficulties'] == ['Easy', 'Medium']
        assert response.data['preferred_topics'] == ['Array', 'Graph']

    def test_update_identities(self, api_client, extension_user):
        """Test linking a Codeforces handle."""
        url = reverse(
            'user-identities',
            kwargs={'extension_id': extension_user.extension_id}
        )
        response = api_client.patch(url, {
            'codeforces_handle': 'tourist',
            'codewars_username': 'kata-grinder',
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['codeforces_handle'] == 'tourist'
        assert response.data['codewars_username'] == 'kata-grinder'


@pytest.mark.django_db
class TestCodeforcesVerificationAPI:
    """Test Codeforces verification endpoint."""

    def test_verify_codeforces_solution(self, api_client, extension_user, mocker):
        """Test verifying an accepted Codeforces submission."""
        extension_user.codeforces_handle = 'tourist'
        extension_user.save(update_fields=['codeforces_handle'])

        mocker.patch(
            'dorso_api.apps.problems.views.CodeforcesService.verify_submission',
            return_value=True,
        )

        url = reverse('verify-codeforces')
        response = api_client.post(url, {
            'extension_id': extension_user.extension_id,
            'challenge_id': '1-A',
            'assigned_at': 1710000000,
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['verified'] is True
        assert response.data['challenge_id'] == '1-A'
