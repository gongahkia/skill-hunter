"""
Serializers for problem submission and responses.
"""

from rest_framework import serializers
from dorso_api.apps.tracking.models import ExtensionUser, ProblemAttempt


class ProblemSubmissionSerializer(serializers.Serializer):
    """Serializer for submitting a solved problem."""

    extension_id = serializers.CharField(max_length=255)
    problem_slug = serializers.CharField(max_length=255)
    problem_title = serializers.CharField(max_length=500)
    difficulty = serializers.ChoiceField(
        choices=['Easy', 'Medium', 'Hard']
    )
    time_taken_seconds = serializers.IntegerField(
        min_value=0,
        required=False,
        allow_null=True
    )

    def validate_extension_id(self, value):
        """Validate that the extension user exists."""
        try:
            ExtensionUser.objects.get(extension_id=value)
        except ExtensionUser.DoesNotExist:
            raise serializers.ValidationError(
                "Extension user not found. Please register first."
            )
        return value

    def create(self, validated_data):
        """Create a problem attempt and session."""
        user = ExtensionUser.objects.get(
            extension_id=validated_data['extension_id']
        )

        # Create successful problem attempt
        attempt = ProblemAttempt.objects.create(
            user=user,
            problem_slug=validated_data['problem_slug'],
            problem_title=validated_data['problem_title'],
            difficulty=validated_data['difficulty'],
            solved=True,
            time_taken_seconds=validated_data.get('time_taken_seconds')
        )

        # Signal handler will automatically create session and update stats
        return attempt


class ProblemAttemptSerializer(serializers.Serializer):
    """Serializer for logging a problem attempt (failed or in-progress)."""

    extension_id = serializers.CharField(max_length=255)
    problem_slug = serializers.CharField(max_length=255)
    problem_title = serializers.CharField(max_length=500)
    difficulty = serializers.ChoiceField(
        choices=['Easy', 'Medium', 'Hard']
    )

    def validate_extension_id(self, value):
        """Validate that the extension user exists."""
        try:
            ExtensionUser.objects.get(extension_id=value)
        except ExtensionUser.DoesNotExist:
            raise serializers.ValidationError(
                "Extension user not found. Please register first."
            )
        return value

    def create(self, validated_data):
        """Create a failed problem attempt."""
        user = ExtensionUser.objects.get(
            extension_id=validated_data['extension_id']
        )

        # Increment total attempts
        user.total_attempts += 1
        user.save()

        # Create failed problem attempt
        attempt = ProblemAttempt.objects.create(
            user=user,
            problem_slug=validated_data['problem_slug'],
            problem_title=validated_data['problem_title'],
            difficulty=validated_data['difficulty'],
            solved=False
        )

        return attempt
