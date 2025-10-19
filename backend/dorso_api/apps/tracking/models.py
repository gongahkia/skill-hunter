"""
Models for tracking user behavior and problem-solving activity.
"""

from django.db import models
from django.utils import timezone
from datetime import timedelta
from django.core.validators import MinValueValidator


class ExtensionUser(models.Model):
    """
    Represents a browser extension installation instance.
    Identified by extension runtime ID, not traditional user accounts.
    """
    extension_id = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Unique identifier from browser extension runtime"
    )
    browser = models.CharField(
        max_length=50,
        choices=[
            ('chrome', 'Google Chrome'),
            ('firefox', 'Mozilla Firefox'),
            ('edge', 'Microsoft Edge'),
            ('other', 'Other'),
        ],
        default='chrome'
    )
    first_seen = models.DateTimeField(auto_now_add=True)
    last_active = models.DateTimeField(auto_now=True)

    # Stats
    total_solves = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )
    current_streak = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )
    longest_streak = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )
    total_attempts = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )

    # Preferences
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'extension_users'
        verbose_name = 'Extension User'
        verbose_name_plural = 'Extension Users'
        ordering = ['-last_active']
        indexes = [
            models.Index(fields=['extension_id']),
            models.Index(fields=['-last_active']),
            models.Index(fields=['-total_solves']),
        ]

    def __str__(self):
        return f"{self.browser}:{self.extension_id[:12]}... ({self.total_solves} solves)"

    def record_solve(self, solved_at=None):
        """
        Increment solve count and update streak.
        Call this when a problem is successfully solved.
        """
        if solved_at is None:
            solved_at = timezone.now()

        self.total_solves += 1

        # Update streak logic
        last_solve = ProblemAttempt.objects.filter(
            user=self,
            solved=True
        ).exclude(
            attempted_at=solved_at
        ).order_by('-attempted_at').first()

        if last_solve:
            time_diff = solved_at - last_solve.attempted_at
            # If last solve was within 24 hours, increment streak
            if time_diff <= timedelta(hours=24):
                self.current_streak += 1
            else:
                self.current_streak = 1
        else:
            self.current_streak = 1

        # Update longest streak
        if self.current_streak > self.longest_streak:
            self.longest_streak = self.current_streak

        self.save()

    def get_active_session(self):
        """Get the active session if one exists and is not expired."""
        return UserSession.objects.filter(
            user=self,
            is_active=True,
            session_end__gt=timezone.now()
        ).first()

    def has_active_session(self):
        """Check if user has an active, non-expired session."""
        return self.get_active_session() is not None


class ProblemAttempt(models.Model):
    """
    Records every problem attempt by a user.
    Tracks both successful and failed attempts.
    """
    user = models.ForeignKey(
        ExtensionUser,
        on_delete=models.CASCADE,
        related_name='attempts'
    )
    problem_slug = models.CharField(max_length=255, db_index=True)
    problem_title = models.CharField(max_length=500)
    difficulty = models.CharField(
        max_length=20,
        choices=[
            ('Easy', 'Easy'),
            ('Medium', 'Medium'),
            ('Hard', 'Hard'),
        ]
    )
    attempted_at = models.DateTimeField(auto_now_add=True)
    solved = models.BooleanField(default=False)
    time_taken_seconds = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text="Time from problem display to successful submission"
    )

    class Meta:
        db_table = 'problem_attempts'
        verbose_name = 'Problem Attempt'
        verbose_name_plural = 'Problem Attempts'
        ordering = ['-attempted_at']
        indexes = [
            models.Index(fields=['user', '-attempted_at']),
            models.Index(fields=['problem_slug']),
            models.Index(fields=['solved']),
            models.Index(fields=['-attempted_at']),
        ]

    def __str__(self):
        status = "✓" if self.solved else "✗"
        return f"{status} {self.problem_title} ({self.difficulty}) - {self.user.extension_id[:12]}..."


class AccessLog(models.Model):
    """
    Logs when users successfully access AI chatbots.
    Links access to the problem they solved to gain that access.
    """
    user = models.ForeignKey(
        ExtensionUser,
        on_delete=models.CASCADE,
        related_name='access_logs'
    )
    chatbot_url = models.URLField(max_length=500)
    chatbot_name = models.CharField(
        max_length=100,
        help_text="Friendly name (ChatGPT, Claude, etc.)"
    )
    accessed_at = models.DateTimeField(auto_now_add=True)
    problem_solved_for_access = models.ForeignKey(
        ProblemAttempt,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='granted_accesses'
    )

    class Meta:
        db_table = 'access_logs'
        verbose_name = 'Access Log'
        verbose_name_plural = 'Access Logs'
        ordering = ['-accessed_at']
        indexes = [
            models.Index(fields=['user', '-accessed_at']),
            models.Index(fields=['-accessed_at']),
        ]

    def __str__(self):
        return f"{self.chatbot_name} access by {self.user.extension_id[:12]}... at {self.accessed_at}"


class UserSession(models.Model):
    """
    Represents an active 15-minute session after solving a problem.
    Sessions expire after SESSION_DURATION_SECONDS (configured in settings).
    """
    user = models.ForeignKey(
        ExtensionUser,
        on_delete=models.CASCADE,
        related_name='sessions'
    )
    session_start = models.DateTimeField(auto_now_add=True)
    session_end = models.DateTimeField()
    is_active = models.BooleanField(default=True, db_index=True)
    problem_attempt = models.ForeignKey(
        ProblemAttempt,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sessions'
    )

    class Meta:
        db_table = 'user_sessions'
        verbose_name = 'User Session'
        verbose_name_plural = 'User Sessions'
        ordering = ['-session_start']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['session_end']),
            models.Index(fields=['-session_start']),
        ]

    def __str__(self):
        status = "Active" if self.is_active and self.session_end > timezone.now() else "Expired"
        return f"{status} session for {self.user.extension_id[:12]}... (ends {self.session_end})"

    def is_expired(self):
        """Check if this session has expired."""
        return timezone.now() > self.session_end

    def deactivate(self):
        """Deactivate this session."""
        self.is_active = False
        self.save()

    @classmethod
    def create_session(cls, user, problem_attempt=None, duration_seconds=900):
        """
        Create a new session for a user.
        Automatically deactivates any existing active sessions.

        Args:
            user: ExtensionUser instance
            problem_attempt: ProblemAttempt that granted this session
            duration_seconds: Session duration (default 900 = 15 minutes)

        Returns:
            UserSession instance
        """
        # Deactivate any existing active sessions
        cls.objects.filter(user=user, is_active=True).update(is_active=False)

        # Create new session
        session_end = timezone.now() + timedelta(seconds=duration_seconds)
        return cls.objects.create(
            user=user,
            session_end=session_end,
            problem_attempt=problem_attempt
        )
