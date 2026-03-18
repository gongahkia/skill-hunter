"""
Service layer for fetching and caching challenge sources.
"""

import random
import json
import requests
from typing import Dict, List, Optional
from django.core.cache import cache
from django.conf import settings
import structlog
from .constants import SOURCE_LABELS, VERIFIED_SOURCES

logger = structlog.get_logger(__name__)

QUESTION_QUERY = """
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    title
    titleSlug
    content
    difficulty
    exampleTestcases
    topicTags {
      name
      slug
    }
  }
}
"""


class LeetCodeService:
    """
    Service for interacting with LeetCode GraphQL API.
    Implements caching to reduce API calls.
    """

    def __init__(self):
        self.endpoint = settings.LEETCODE_GRAPHQL_ENDPOINT
        self.cache_ttl = settings.LEETCODE_CACHE_TTL
        self.problem_slugs = self._load_problem_slugs()

    def _load_problem_slugs(self) -> List[str]:
        """Load problem slugs from questions.txt file."""
        cache_key = 'problem_slugs_list'
        cached = cache.get(cache_key)

        if cached:
            return cached

        try:
            import os
            base_dir = settings.BASE_DIR.parent  # Go up from backend/
            questions_file = os.path.join(base_dir, 'data', 'questions.txt')

            with open(questions_file, 'r') as f:
                slugs = [line.strip() for line in f if line.strip()]

            # Cache for 24 hours
            cache.set(cache_key, slugs, timeout=86400)

            logger.info("loaded_problem_slugs", count=len(slugs))
            return slugs

        except FileNotFoundError:
            logger.error("questions_file_not_found", file=questions_file)
            # Fallback to a small set of problems
            return [
                "two-sum",
                "add-two-numbers",
                "longest-substring-without-repeating-characters",
                "median-of-two-sorted-arrays",
                "longest-palindromic-substring",
            ]

    def get_random_problem_slug(self) -> str:
        """Get a random problem slug from the list."""
        return random.choice(self.problem_slugs)

    def fetch_problem(self, title_slug: str) -> Optional[Dict]:
        """
        Fetch a problem from LeetCode API.
        Uses Redis cache to avoid repeated API calls.

        Args:
            title_slug: The LeetCode problem slug (e.g., "two-sum")

        Returns:
            Dict with problem data or None if fetch failed
        """
        cache_key = f'leetcode_problem:{title_slug}'
        cached_problem = cache.get(cache_key)

        if cached_problem:
            logger.debug("problem_cache_hit", slug=title_slug)
            return cached_problem

        try:
            response = requests.post(
                self.endpoint,
                json={
                    'query': QUESTION_QUERY,
                    'variables': {'titleSlug': title_slug}
                },
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                timeout=10
            )
            response.raise_for_status()

            data = response.json()

            if 'errors' in data:
                logger.error(
                    "leetcode_api_error",
                    slug=title_slug,
                    errors=data['errors']
                )
                return None

            problem = data.get('data', {}).get('question')

            if problem:
                # Cache for configured TTL (default 7 days)
                cache.set(cache_key, problem, timeout=self.cache_ttl)
                logger.info("problem_fetched", slug=title_slug)
                return problem

            return None

        except requests.RequestException as e:
            logger.error(
                "leetcode_api_request_failed",
                slug=title_slug,
                error=str(e)
            )
            return None

    def get_random_problem(self) -> Optional[Dict]:
        """
        Get a random problem from LeetCode.

        Returns:
            Dict with problem data or None if fetch failed
        """
        max_attempts = 5
        for attempt in range(max_attempts):
            slug = self.get_random_problem_slug()
            problem = self.fetch_problem(slug)

            if problem:
                return problem

            logger.warning(
                "failed_to_fetch_problem",
                slug=slug,
                attempt=attempt + 1
            )

        logger.error("failed_to_get_random_problem_after_retries")
        return None

    def find_problem(
        self,
        difficulty_filters=None,
        topic_filters=None,
        excluded_slugs=None,
        selection_mode='matched',
    ):
        """
        Select a LeetCode problem while respecting the provided filters.
        """
        difficulty_filters = set(difficulty_filters or [])
        topic_filters = {topic.lower() for topic in (topic_filters or [])}
        excluded_slugs = set(excluded_slugs or [])
        for _ in range(20):
            slug = self.get_random_problem_slug()
            if slug in excluded_slugs:
                continue

            problem = self.fetch_problem(slug)
            if not problem:
                continue

            if difficulty_filters and problem.get('difficulty') not in difficulty_filters:
                continue

            if topic_filters:
                problem_topics = {
                    topic.get('name', '').lower()
                    for topic in problem.get('topicTags', [])
                }
                if not problem_topics.intersection(topic_filters):
                    continue

            return self._normalize_problem(problem, selection_mode)

        return None

    def get_filtered_problem(self, difficulty_filters=None, topic_filters=None, excluded_slugs=None):
        selection_steps = [
            ('matched', difficulty_filters, topic_filters),
            ('topic_relaxed', difficulty_filters, []),
            ('fully_relaxed', [], []),
        ]

        for selection_mode, difficulties, topics in selection_steps:
            problem = self.find_problem(
                difficulty_filters=difficulties,
                topic_filters=topics,
                excluded_slugs=excluded_slugs,
                selection_mode=selection_mode,
            )
            if problem:
                return problem

        fallback = self.get_random_problem()
        return self._normalize_problem(fallback, 'fully_relaxed') if fallback else None

    def _normalize_problem(self, problem: Optional[Dict], selection_mode: str) -> Optional[Dict]:
        if not problem:
            return None

        topic_tags = [topic.get('name') for topic in problem.get('topicTags', []) if topic.get('name')]
        slug = problem['titleSlug']

        return {
            'source': 'leetcode',
            'source_label': SOURCE_LABELS['leetcode'],
            'challenge_id': problem['questionId'],
            'title': problem['title'],
            'slug': slug,
            'url': f'https://leetcode.com/problems/{slug}/description/',
            'content': problem['content'],
            'difficulty': problem['difficulty'],
            'topic_tags': topic_tags,
            'selection_mode': selection_mode,
            'supports_verification': True,
            'example_testcases': problem.get('exampleTestcases', ''),
        }


class CodeforcesService:
    """
    Service for selecting and verifying Codeforces problems.
    """

    def __init__(self):
        self.endpoint = 'https://codeforces.com/api'
        self.problemset_cache_key = 'codeforces_problemset'
        self.problemset_ttl = 86400

    def _get_problemset(self) -> List[Dict]:
        cached_problemset = cache.get(self.problemset_cache_key)
        if cached_problemset:
            return cached_problemset

        response = requests.get(
            f'{self.endpoint}/problemset.problems',
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()

        if payload.get('status') != 'OK':
            raise ValueError('Codeforces API returned a non-OK status.')

        problems = payload.get('result', {}).get('problems', [])
        cache.set(self.problemset_cache_key, problems, timeout=self.problemset_ttl)
        return problems

    @staticmethod
    def _map_difficulty(rating: Optional[int]) -> str:
        if rating is None or rating <= 1200:
            return 'Easy'
        if rating <= 1800:
            return 'Medium'
        return 'Hard'

    def find_problem(
        self,
        difficulty_filters=None,
        topic_filters=None,
        excluded_ids=None,
        selection_mode='matched',
    ) -> Optional[Dict]:
        difficulty_filters = set(difficulty_filters or [])
        topic_filters = {topic.lower() for topic in (topic_filters or [])}
        excluded_ids = set(excluded_ids or [])

        candidates = list(self._get_problemset())
        random.shuffle(candidates)

        for problem in candidates:
            contest_id = problem.get('contestId')
            problem_index = problem.get('index')
            if not contest_id or not problem_index:
                continue

            challenge_id = f'{contest_id}-{problem_index}'
            if challenge_id in excluded_ids:
                continue

            difficulty = self._map_difficulty(problem.get('rating'))
            if difficulty_filters and difficulty not in difficulty_filters:
                continue

            tags = [tag for tag in problem.get('tags', []) if tag]
            if topic_filters and not {tag.lower() for tag in tags}.intersection(topic_filters):
                continue

            return self._normalize_problem(problem, selection_mode)

        return None

    def _normalize_problem(self, problem: Dict, selection_mode: str) -> Dict:
        contest_id = problem['contestId']
        problem_index = problem['index']
        tags = [tag for tag in problem.get('tags', []) if tag]
        rating = problem.get('rating')

        summary = (
            '<p>Codeforces does not expose full statements through its public API.</p>'
            f'<p>Open the problem page for the complete prompt. Tags: {", ".join(tags) or "untagged"}.</p>'
        )

        return {
            'source': 'codeforces',
            'source_label': SOURCE_LABELS['codeforces'],
            'challenge_id': f'{contest_id}-{problem_index}',
            'title': problem['name'],
            'slug': f'{contest_id}-{problem_index}',
            'url': f'https://codeforces.com/problemset/problem/{contest_id}/{problem_index}',
            'content': summary,
            'difficulty': self._map_difficulty(rating),
            'topic_tags': tags,
            'selection_mode': selection_mode,
            'supports_verification': True,
            'rating': rating,
            'contest_id': contest_id,
            'problem_index': problem_index,
        }

    def verify_submission(
        self,
        handle: str,
        challenge_id: str,
        assigned_at_seconds: Optional[int] = None,
    ) -> bool:
        contest_id, problem_index = challenge_id.split('-', 1)
        response = requests.get(
            f'{self.endpoint}/user.status',
            params={
                'handle': handle,
                'from': 1,
                'count': 100,
            },
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()

        if payload.get('status') != 'OK':
            return False

        submissions = payload.get('result', [])
        for submission in submissions:
            problem = submission.get('problem', {})
            if str(problem.get('contestId')) != contest_id:
                continue
            if problem.get('index') != problem_index:
                continue
            if submission.get('verdict') != 'OK':
                continue
            if assigned_at_seconds and submission.get('creationTimeSeconds', 0) < assigned_at_seconds:
                continue
            return True

        return False


class ChallengeSelectionService:
    """
    Select challenges across verified sources while honoring filters when possible.
    """

    def __init__(self):
        self.services = {
            'leetcode': LeetCodeService(),
            'codeforces': CodeforcesService(),
        }

    @staticmethod
    def _recent_attempts_by_source(user) -> Dict[str, List[str]]:
        recent_attempts = user.attempts.all()[:20]
        recent = {source: [] for source in VERIFIED_SOURCES}

        for attempt in recent_attempts:
            value = attempt.challenge_id if attempt.source == 'codeforces' else attempt.problem_slug
            recent.setdefault(attempt.source, []).append(value)

        return recent

    @staticmethod
    def _enabled_sources(user) -> List[str]:
        enabled_sources = user.enabled_verified_sources or ['leetcode']
        eligible = []

        for source in enabled_sources:
            if source == 'codeforces' and not user.codeforces_handle:
                continue
            eligible.append(source)

        return eligible or ['leetcode']

    def _try_sources(
        self,
        sources,
        difficulty_filters,
        topic_filters,
        recent_attempts,
        selection_mode,
    ):
        source_pool = list(dict.fromkeys(sources))
        random.shuffle(source_pool)

        for source in source_pool:
            service = self.services[source]
            excluded = recent_attempts.get(source, [])
            if source == 'codeforces':
                problem = service.find_problem(
                    difficulty_filters=difficulty_filters,
                    topic_filters=topic_filters,
                    excluded_ids=excluded,
                    selection_mode=selection_mode,
                )
            else:
                problem = service.find_problem(
                    difficulty_filters=difficulty_filters,
                    topic_filters=topic_filters,
                    excluded_slugs=excluded,
                    selection_mode=selection_mode,
                )
            if problem:
                return problem

        return None

    def get_random_problem(self, user=None):
        if not user:
            return self.services['leetcode'].get_filtered_problem()

        enabled_sources = self._enabled_sources(user)
        all_available_sources = ['leetcode']
        if user.codeforces_handle:
            all_available_sources.append('codeforces')

        recent_attempts = self._recent_attempts_by_source(user)
        selection_steps = [
            ('matched', enabled_sources, user.preferred_difficulties, user.preferred_topics),
            ('topic_relaxed', enabled_sources, user.preferred_difficulties, []),
            ('source_relaxed', all_available_sources, user.preferred_difficulties, []),
            ('fully_relaxed', all_available_sources, [], []),
        ]

        for selection_mode, sources, difficulties, topics in selection_steps:
            problem = self._try_sources(
                sources=sources,
                difficulty_filters=difficulties,
                topic_filters=topics,
                recent_attempts=recent_attempts,
                selection_mode=selection_mode,
            )
            if problem:
                return problem

        return self.services['leetcode'].get_filtered_problem()


class ProblemQueueService:
    """
    Service for managing a queue of pre-fetched problems in Redis.
    This reduces latency when users need a problem.
    """

    def __init__(self):
        self.queue_key = 'problem_queue'
        self.queue_size = 20  # Keep 20 problems ready
        self.leetcode_service = LeetCodeService()

    def get_queue_length(self) -> int:
        """Get current queue length."""
        return cache.llen(self.queue_key) or 0

    def refill_queue(self, target_size: int = None):
        """
        Refill the problem queue to target size.

        Args:
            target_size: Target queue size (default: self.queue_size)
        """
        if target_size is None:
            target_size = self.queue_size

        current_size = self.get_queue_length()
        needed = target_size - current_size

        if needed <= 0:
            return

        logger.info(
            "refilling_problem_queue",
            current_size=current_size,
            needed=needed
        )

        for _ in range(needed):
            problem = self.leetcode_service.get_random_problem()
            if problem:
                cache.rpush(self.queue_key, problem['titleSlug'])

    def pop_problem(self) -> Optional[Dict]:
        """
        Pop a problem from the queue and fetch its full data.
        Automatically triggers queue refill if running low.

        Returns:
            Dict with problem data or None
        """
        slug = cache.lpop(self.queue_key)

        # Refill queue in background if running low
        if self.get_queue_length() < 5:
            self.refill_queue()

        if slug:
            return self.leetcode_service.fetch_problem(slug)

        # Queue was empty, fetch directly
        logger.warning("problem_queue_empty_fetching_directly")
        return self.leetcode_service.get_random_problem()


class PracticeCatalogService:
    """
    Load curated catalog-only challenges from static sources.
    """

    def __init__(self):
        self.cache_key = 'practice_catalog'
        self.catalog_ttl = 86400

    def get_catalog(self) -> List[Dict]:
        cached_catalog = cache.get(self.cache_key)
        if cached_catalog:
            return cached_catalog

        catalog_path = settings.BASE_DIR.parent / 'data' / 'practice_sources.json'
        with open(catalog_path, 'r', encoding='utf-8') as practice_file:
            catalog = json.load(practice_file)

        cache.set(self.cache_key, catalog, timeout=self.catalog_ttl)
        return catalog

    def get_practice_deck(self, limit: int = 6) -> List[Dict]:
        catalog = list(self.get_catalog())
        random.shuffle(catalog)
        return catalog[:limit]
