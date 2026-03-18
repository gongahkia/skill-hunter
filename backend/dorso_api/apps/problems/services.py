"""
Service layer for fetching and caching LeetCode problems.
"""

import random
import requests
from typing import Dict, List, Optional
from django.core.cache import cache
from django.conf import settings
import structlog
from .constants import SOURCE_LABELS

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

    def get_filtered_problem(self, difficulty_filters=None, topic_filters=None, excluded_slugs=None):
        """
        Select a LeetCode problem while respecting user filters when possible.
        """
        difficulty_filters = set(difficulty_filters or [])
        topic_filters = {topic.lower() for topic in (topic_filters or [])}
        excluded_slugs = set(excluded_slugs or [])
        selection_steps = [
            ("matched", True, True),
            ("topic_relaxed", True, False),
            ("fully_relaxed", False, False),
        ]

        for selection_mode, apply_difficulty, apply_topics in selection_steps:
            for _ in range(20):
                slug = self.get_random_problem_slug()
                if slug in excluded_slugs:
                    continue

                problem = self.fetch_problem(slug)
                if not problem:
                    continue

                if apply_difficulty and difficulty_filters:
                    if problem.get('difficulty') not in difficulty_filters:
                        continue

                if apply_topics and topic_filters:
                    problem_topics = {
                        topic.get('name', '').lower()
                        for topic in problem.get('topicTags', [])
                    }
                    if not problem_topics.intersection(topic_filters):
                        continue

                return self._normalize_problem(problem, selection_mode)

        fallback = self.get_random_problem()
        return self._normalize_problem(fallback, "fully_relaxed") if fallback else None

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
