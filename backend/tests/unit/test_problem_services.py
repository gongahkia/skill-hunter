"""
Unit tests for challenge source services.
"""

import pytest

from dorso_api.apps.problems.services import (
    LeetCodeService,
    CodeforcesService,
    ChallengeSelectionService,
    PracticeCatalogService,
)


class MockResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


@pytest.mark.django_db
class TestLeetCodeService:
    def test_normalize_problem(self):
        service = LeetCodeService()
        normalized = service._normalize_problem({
            'questionId': '1',
            'title': 'Two Sum',
            'titleSlug': 'two-sum',
            'content': '<p>Test</p>',
            'difficulty': 'Easy',
            'exampleTestcases': '[]',
            'topicTags': [{'name': 'Array'}],
        }, 'matched')

        assert normalized['source'] == 'leetcode'
        assert normalized['challenge_id'] == '1'
        assert normalized['topic_tags'] == ['Array']

    def test_find_problem_respects_filters(self, mocker):
        service = LeetCodeService()
        mocker.patch.object(service, 'get_random_problem_slug', side_effect=['two-sum', 'graph-problem'])
        mocker.patch.object(service, 'fetch_problem', side_effect=[
            {
                'questionId': '1',
                'title': 'Two Sum',
                'titleSlug': 'two-sum',
                'content': '<p>Test</p>',
                'difficulty': 'Easy',
                'topicTags': [{'name': 'Array'}],
            },
            {
                'questionId': '2',
                'title': 'Network Delay',
                'titleSlug': 'graph-problem',
                'content': '<p>Graph</p>',
                'difficulty': 'Medium',
                'topicTags': [{'name': 'Graph'}],
            },
        ])

        problem = service.find_problem(
            difficulty_filters=['Medium'],
            topic_filters=['Graph'],
            selection_mode='matched',
        )

        assert problem['slug'] == 'graph-problem'
        assert problem['selection_mode'] == 'matched'

    def test_get_filtered_problem_relaxes_topic_filter(self, mocker):
        service = LeetCodeService()
        mocker.patch.object(service, 'find_problem', side_effect=[
            None,
            {
                'source': 'leetcode',
                'challenge_id': '1',
                'title': 'Two Sum',
                'slug': 'two-sum',
                'url': 'https://leetcode.com/problems/two-sum/description/',
                'difficulty': 'Easy',
                'topic_tags': ['Array'],
                'selection_mode': 'topic_relaxed',
                'supports_verification': True,
            },
        ])

        problem = service.get_filtered_problem(
            difficulty_filters=['Easy'],
            topic_filters=['Graph'],
            excluded_slugs=[],
        )

        assert problem['selection_mode'] == 'topic_relaxed'


class TestCodeforcesService:
    def test_map_difficulty(self):
        assert CodeforcesService._map_difficulty(1100) == 'Easy'
        assert CodeforcesService._map_difficulty(1600) == 'Medium'
        assert CodeforcesService._map_difficulty(2200) == 'Hard'

    def test_find_problem_uses_problemset_filters(self, mocker):
        service = CodeforcesService()
        mocker.patch.object(service, '_get_problemset', return_value=[
            {
                'contestId': 1,
                'index': 'A',
                'name': 'Watermelon',
                'rating': 800,
                'tags': ['math'],
            },
            {
                'contestId': 2,
                'index': 'C',
                'name': 'Graph Paths',
                'rating': 1600,
                'tags': ['graphs', 'dp'],
            },
        ])

        problem = service.find_problem(
            difficulty_filters=['Medium'],
            topic_filters=['graphs'],
            selection_mode='matched',
        )

        assert problem['source'] == 'codeforces'
        assert problem['challenge_id'] == '2-C'
        assert 'graphs' in [tag.lower() for tag in problem['topic_tags']]

    def test_verify_submission_matches_ok_submission(self, mocker):
        service = CodeforcesService()
        mocker.patch('dorso_api.apps.problems.services.requests.get', return_value=MockResponse({
            'status': 'OK',
            'result': [
                {
                    'verdict': 'WRONG_ANSWER',
                    'creationTimeSeconds': 1000,
                    'problem': {'contestId': 1, 'index': 'A'},
                },
                {
                    'verdict': 'OK',
                    'creationTimeSeconds': 2000,
                    'problem': {'contestId': 1, 'index': 'A'},
                },
            ],
        }))

        assert service.verify_submission('tourist', '1-A', assigned_at_seconds=1500) is True


@pytest.mark.django_db
class TestChallengeSelectionService:
    def test_enabled_sources_skip_codeforces_without_handle(self, extension_user):
        extension_user.enabled_verified_sources = ['leetcode', 'codeforces']

        assert ChallengeSelectionService._enabled_sources(extension_user) == ['leetcode']

    def test_get_random_problem_uses_available_verified_source(self, extension_user, mocker):
        extension_user.codeforces_handle = 'tourist'
        extension_user.enabled_verified_sources = ['leetcode', 'codeforces']
        extension_user.save(update_fields=['codeforces_handle', 'enabled_verified_sources'])

        service = ChallengeSelectionService()
        mocker.patch.object(service.services['leetcode'], 'find_problem', return_value=None)
        mocker.patch.object(service.services['codeforces'], 'find_problem', return_value={
            'source': 'codeforces',
            'challenge_id': '1-A',
            'title': 'Watermelon',
            'slug': '1-A',
            'url': 'https://codeforces.com/problemset/problem/1/A',
            'difficulty': 'Easy',
            'topic_tags': ['math'],
            'selection_mode': 'matched',
            'supports_verification': True,
        })

        challenge = service.get_random_problem(user=extension_user)

        assert challenge['source'] == 'codeforces'
        assert challenge['challenge_id'] == '1-A'

    def test_get_random_problem_without_user_falls_back_to_leetcode(self, mocker):
        service = ChallengeSelectionService()
        mocker.patch.object(service.services['leetcode'], 'get_filtered_problem', return_value={
            'source': 'leetcode',
            'challenge_id': '1',
            'title': 'Two Sum',
            'slug': 'two-sum',
            'url': 'https://leetcode.com/problems/two-sum/description/',
            'difficulty': 'Easy',
            'topic_tags': ['Array'],
            'selection_mode': 'matched',
            'supports_verification': True,
        })

        challenge = service.get_random_problem()

        assert challenge['source'] == 'leetcode'

    def test_try_sources_uses_leetcode_excluded_slugs(self, mocker):
        service = ChallengeSelectionService()
        leetcode_find = mocker.patch.object(service.services['leetcode'], 'find_problem', return_value={
            'source': 'leetcode',
            'challenge_id': '1',
            'title': 'Two Sum',
            'slug': 'two-sum',
            'url': 'https://leetcode.com/problems/two-sum/description/',
            'difficulty': 'Easy',
            'topic_tags': ['Array'],
            'selection_mode': 'matched',
            'supports_verification': True,
        })

        challenge = service._try_sources(
            sources=['leetcode'],
            difficulty_filters=['Easy'],
            topic_filters=['Array'],
            recent_attempts={'leetcode': ['old-problem']},
            selection_mode='matched',
        )

        leetcode_find.assert_called_once()
        assert challenge['slug'] == 'two-sum'


class TestPracticeCatalogService:
    def test_get_practice_deck_returns_catalog_entries(self):
        service = PracticeCatalogService()
        deck = service.get_practice_deck(limit=3)

        assert len(deck) == 3
        assert all(item['supports_verification'] is False for item in deck)
