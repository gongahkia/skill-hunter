"""
Views for problem management and submission.
"""

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from prometheus_client import Counter
import structlog

from .services import (
    LeetCodeService,
    ProblemQueueService,
    ChallengeSelectionService,
    CodeforcesService,
    PracticeCatalogService,
)
from .serializers import (
    ProblemSubmissionSerializer,
    ProblemAttemptSerializer,
    CodeforcesVerificationSerializer,
)
from dorso_api.apps.tracking.models import ExtensionUser

logger = structlog.get_logger(__name__)

# Prometheus metrics
problems_fetched = Counter(
    'dorso_problems_fetched_total',
    'Total number of problems fetched'
)
problems_solved = Counter(
    'dorso_problems_solved_total',
    'Total number of problems solved',
    ['difficulty']
)
problems_attempted = Counter(
    'dorso_problems_attempted_total',
    'Total number of problems attempted',
    ['difficulty']
)


class RandomProblemView(APIView):
    """
    Get a random LeetCode problem.
    GET /api/v1/problems/random/
    """

    def get(self, request):
        service = ChallengeSelectionService()
        extension_id = request.query_params.get('extension_id')
        user = None

        if extension_id:
            user = ExtensionUser.objects.filter(extension_id=extension_id).first()

        problem = service.get_random_problem(user=user)

        if problem:
            problems_fetched.inc()

            logger.info(
                "random_problem_fetched",
                slug=problem['slug'],
                difficulty=problem.get('difficulty')
            )

            return Response(problem)

        logger.error("failed_to_fetch_random_problem")
        return Response(
            {'error': 'Failed to fetch problem. Please try again.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )


class SubmitSolutionView(APIView):
    """
    Submit a successfully solved problem.
    Creates a problem attempt record and starts a new session.
    POST /api/v1/problems/submit/
    """

    def post(self, request):
        serializer = ProblemSubmissionSerializer(data=request.data)

        if serializer.is_valid():
            attempt = serializer.save()

            problems_solved.labels(difficulty=attempt.difficulty).inc()

            logger.info(
                "problem_submitted",
                extension_id=attempt.user.extension_id,
                problem_slug=attempt.problem_slug,
                source=attempt.source,
                difficulty=attempt.difficulty,
                time_taken=attempt.time_taken_seconds,
            )

            # Get the created session
            session = attempt.user.get_active_session()

            return Response({
                'success': True,
                'message': 'Problem solved! You now have access to AI chatbots.',
                'session_expires': session.session_end if session else None,
                'total_solves': attempt.user.total_solves,
                'current_streak': attempt.user.current_streak,
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogAttemptView(APIView):
    """
    Log a failed or in-progress problem attempt.
    POST /api/v1/problems/attempt/
    """

    def post(self, request):
        serializer = ProblemAttemptSerializer(data=request.data)

        if serializer.is_valid():
            attempt = serializer.save()

            problems_attempted.labels(difficulty=attempt.difficulty).inc()

            logger.info(
                "problem_attempted",
                extension_id=attempt.user.extension_id,
                problem_slug=attempt.problem_slug,
                source=attempt.source,
                difficulty=attempt.difficulty,
            )

            return Response({
                'success': True,
                'message': 'Attempt logged.',
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyCodeforcesView(APIView):
    """
    Verify that the linked Codeforces handle solved the assigned problem.
    POST /api/v1/problems/verify-codeforces/
    """

    def post(self, request):
        serializer = CodeforcesVerificationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = ExtensionUser.objects.get(
            extension_id=serializer.validated_data['extension_id']
        )
        service = CodeforcesService()
        verified = service.verify_submission(
            handle=user.codeforces_handle,
            challenge_id=serializer.validated_data['challenge_id'],
            assigned_at_seconds=serializer.validated_data.get('assigned_at'),
        )

        return Response({
            'verified': verified,
            'handle': user.codeforces_handle,
            'challenge_id': serializer.validated_data['challenge_id'],
            'message': 'Accepted submission found.' if verified else 'No accepted submission matched the assigned challenge yet.',
        })


class PracticeDeckView(APIView):
    """
    Return a curated practice deck from catalog-only sources.
    GET /api/v1/problems/practice-deck/
    """

    def get(self, request):
        service = PracticeCatalogService()
        return Response({
            'items': service.get_practice_deck(),
        })


@api_view(['GET'])
def fetch_problem_by_slug(request, slug):
    """
    Fetch a specific problem by its slug.
    GET /api/v1/problems/{slug}/
    """
    service = LeetCodeService()
    problem = service.fetch_problem(slug)

    if problem:
        return Response(service._normalize_problem(problem, 'matched'))

    return Response(
        {'error': f'Problem "{slug}" not found.'},
        status=status.HTTP_404_NOT_FOUND
    )


@api_view(['POST'])
def refill_problem_queue(request):
    """
    Manually trigger problem queue refill.
    POST /api/v1/problems/refill-queue/
    (Admin/maintenance endpoint)
    """
    service = ProblemQueueService()
    service.refill_queue()

    return Response({
        'success': True,
        'queue_length': service.get_queue_length()
    })
