"""
Serializers for tracking app.
"""

from rest_framework import serializers
from django.db.models import Count
from .models import ExtensionUser, ProblemAttempt, AccessLog, UserSession
from dorso_api.apps.problems.constants import DIFFICULTY_CHOICES, SOURCE_LABELS, VERIFIED_SOURCES


class ExtensionUserSerializer(serializers.ModelSerializer):
    """Serializer for ExtensionUser model."""

    has_active_session = serializers.SerializerMethodField()
    active_session_expires = serializers.SerializerMethodField()

    class Meta:
        model = ExtensionUser
        fields = [
            'id',
            'extension_id',
            'browser',
            'first_seen',
            'last_active',
            'total_solves',
            'current_streak',
            'longest_streak',
            'total_attempts',
            'is_active',
            'has_active_session',
            'active_session_expires',
        ]
        read_only_fields = [
            'id',
            'first_seen',
            'last_active',
            'total_solves',
            'current_streak',
            'longest_streak',
            'total_attempts',
        ]

    def get_has_active_session(self, obj):
        """Check if user has an active session."""
        return obj.has_active_session()

    def get_active_session_expires(self, obj):
        """Get when the active session expires, if any."""
        session = obj.get_active_session()
        return session.session_end if session else None


class ExtensionUserStatsSerializer(serializers.ModelSerializer):
    """Detailed statistics for an extension user."""

    recent_attempts = serializers.SerializerMethodField()
    solve_rate = serializers.SerializerMethodField()
    favorite_difficulty = serializers.SerializerMethodField()
    recent_accesses = serializers.SerializerMethodField()
    active_session = serializers.SerializerMethodField()
    source_mix = serializers.SerializerMethodField()
    preferences = serializers.SerializerMethodField()
    identities = serializers.SerializerMethodField()

    class Meta:
        model = ExtensionUser
        fields = [
            'extension_id',
            'total_solves',
            'total_attempts',
            'current_streak',
            'longest_streak',
            'solve_rate',
            'favorite_difficulty',
            'recent_accesses',
            'active_session',
            'source_mix',
            'preferences',
            'identities',
            'recent_attempts',
        ]

    def get_recent_attempts(self, obj):
        """Get last 10 attempts."""
        attempts = obj.attempts.all()[:10]
        return ProblemAttemptSerializer(attempts, many=True).data

    def get_solve_rate(self, obj):
        """Calculate success rate."""
        if obj.total_attempts == 0:
            return 0.0
        return round((obj.total_solves / obj.total_attempts) * 100, 2)

    def get_favorite_difficulty(self, obj):
        """Get most frequently solved difficulty."""
        result = obj.attempts.filter(solved=True).values('difficulty').annotate(
            count=Count('difficulty')
        ).order_by('-count').first()
        return result['difficulty'] if result else None

    def get_recent_accesses(self, obj):
        """Get the most recent chatbot accesses."""
        accesses = obj.access_logs.all()[:10]
        return RecentAccessLogSerializer(accesses, many=True).data

    def get_active_session(self, obj):
        """Return active session summary."""
        session = obj.get_active_session()
        if not session:
            return None

        return {
            'session_id': session.id,
            'session_start': session.session_start,
            'session_end': session.session_end,
            'problem_source': session.problem_attempt.source if session.problem_attempt else None,
        }

    def get_source_mix(self, obj):
        """Return counts of attempts grouped by source."""
        source_rows = obj.attempts.values('source').annotate(count=Count('source'))
        return {
            row['source']: {
                'label': SOURCE_LABELS.get(row['source'], row['source'].title()),
                'count': row['count'],
            }
            for row in source_rows
        }

    def get_preferences(self, obj):
        """Expose current challenge preferences."""
        return {
            'preferred_difficulties': obj.preferred_difficulties,
            'preferred_topics': obj.preferred_topics,
            'enabled_verified_sources': obj.enabled_verified_sources,
        }

    def get_identities(self, obj):
        """Expose linked external identities."""
        return {
            'codeforces_handle': obj.codeforces_handle,
            'codewars_username': obj.codewars_username,
        }


class ProblemAttemptSerializer(serializers.ModelSerializer):
    """Serializer for ProblemAttempt model."""

    class Meta:
        model = ProblemAttempt
        fields = [
            'id',
            'user',
            'problem_slug',
            'problem_title',
            'difficulty',
            'source',
            'challenge_id',
            'topic_tags',
            'attempted_at',
            'solved',
            'time_taken_seconds',
        ]
        read_only_fields = ['id', 'attempted_at']


class AccessLogSerializer(serializers.ModelSerializer):
    """Serializer for AccessLog model."""

    extension_id = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = AccessLog
        fields = [
            'id',
            'user',
            'extension_id',
            'chatbot_url',
            'chatbot_name',
            'accessed_at',
            'problem_solved_for_access',
        ]
        read_only_fields = ['id', 'accessed_at']

    def validate(self, attrs):
        """Accept either a user primary key or an extension identifier."""
        extension_id = attrs.pop('extension_id', None)
        if extension_id and 'user' not in attrs:
            try:
                attrs['user'] = ExtensionUser.objects.get(extension_id=extension_id)
            except ExtensionUser.DoesNotExist as exc:
                raise serializers.ValidationError({
                    'extension_id': 'Extension user not found. Please register first.'
                }) from exc
        return attrs


class UserSessionSerializer(serializers.ModelSerializer):
    """Serializer for UserSession model."""

    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = UserSession
        fields = [
            'id',
            'user',
            'session_start',
            'session_end',
            'is_active',
            'is_expired',
            'problem_attempt',
        ]
        read_only_fields = ['id', 'session_start', 'session_end']

    def get_is_expired(self, obj):
        """Check if session is expired."""
        return obj.is_expired()


class RegisterUserSerializer(serializers.Serializer):
    """Serializer for registering a new extension user."""

    extension_id = serializers.CharField(max_length=255)
    browser = serializers.ChoiceField(
        choices=['chrome', 'firefox', 'edge', 'other'],
        default='chrome'
    )

    def create(self, validated_data):
        """Create or update extension user."""
        user, created = ExtensionUser.objects.get_or_create(
            extension_id=validated_data['extension_id'],
            defaults={'browser': validated_data.get('browser', 'chrome')}
        )
        if not created:
            # Update last_active timestamp
            user.save()
        return user


class CheckSessionSerializer(serializers.Serializer):
    """Serializer for checking if a session is active."""

    extension_id = serializers.CharField(max_length=255)

    def validate_extension_id(self, value):
        """Validate that the extension_id exists."""
        if not ExtensionUser.objects.filter(extension_id=value).exists():
            raise serializers.ValidationError(
                "Extension user not found. Please register first."
            )
        return value


class ExtensionUserPreferencesSerializer(serializers.ModelSerializer):
    """Serializer for user preference updates."""

    preferred_difficulties = serializers.ListField(
        child=serializers.ChoiceField(choices=DIFFICULTY_CHOICES),
        allow_empty=True,
        required=False,
    )
    preferred_topics = serializers.ListField(
        child=serializers.CharField(max_length=100),
        allow_empty=True,
        required=False,
    )
    enabled_verified_sources = serializers.ListField(
        child=serializers.ChoiceField(choices=VERIFIED_SOURCES),
        allow_empty=True,
        required=False,
    )

    class Meta:
        model = ExtensionUser
        fields = [
            'preferred_difficulties',
            'preferred_topics',
            'enabled_verified_sources',
        ]


class ExtensionUserIdentitySerializer(serializers.ModelSerializer):
    """Serializer for linked external identities."""

    class Meta:
        model = ExtensionUser
        fields = [
            'codeforces_handle',
            'codewars_username',
        ]


class RecentAccessLogSerializer(serializers.ModelSerializer):
    """Compact serializer for recent access rows."""

    class Meta:
        model = AccessLog
        fields = [
            'chatbot_name',
            'chatbot_url',
            'accessed_at',
        ]
