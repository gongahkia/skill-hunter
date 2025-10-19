"""
Signal handlers for tracking app.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import ProblemAttempt, UserSession
from django.conf import settings
import structlog

logger = structlog.get_logger(__name__)


@receiver(post_save, sender=ProblemAttempt)
def handle_successful_solve(sender, instance, created, **kwargs):
    """
    When a problem is successfully solved, create a new session
    and update user statistics.
    """
    if created and instance.solved:
        # Update user solve count and streak
        instance.user.record_solve(instance.attempted_at)

        # Create new 15-minute session
        session = UserSession.create_session(
            user=instance.user,
            problem_attempt=instance,
            duration_seconds=settings.SESSION_DURATION_SECONDS
        )

        logger.info(
            "problem_solved",
            extension_id=instance.user.extension_id,
            problem_slug=instance.problem_slug,
            difficulty=instance.difficulty,
            time_taken=instance.time_taken_seconds,
            session_id=session.id,
        )
