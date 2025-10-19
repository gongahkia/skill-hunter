"""
Django admin configuration for tracking app.
"""

from django.contrib import admin
from .models import ExtensionUser, ProblemAttempt, AccessLog, UserSession


@admin.register(ExtensionUser)
class ExtensionUserAdmin(admin.ModelAdmin):
    list_display = [
        'extension_id_short',
        'browser',
        'total_solves',
        'current_streak',
        'longest_streak',
        'total_attempts',
        'last_active',
        'is_active',
    ]
    list_filter = ['browser', 'is_active', 'first_seen']
    search_fields = ['extension_id']
    readonly_fields = [
        'extension_id',
        'first_seen',
        'last_active',
        'total_solves',
        'current_streak',
        'longest_streak',
        'total_attempts',
    ]
    ordering = ['-last_active']

    def extension_id_short(self, obj):
        return f"{obj.extension_id[:16]}..."
    extension_id_short.short_description = 'Extension ID'


@admin.register(ProblemAttempt)
class ProblemAttemptAdmin(admin.ModelAdmin):
    list_display = [
        'user_short',
        'problem_title',
        'difficulty',
        'solved',
        'time_taken_seconds',
        'attempted_at',
    ]
    list_filter = ['solved', 'difficulty', 'attempted_at']
    search_fields = ['problem_title', 'problem_slug', 'user__extension_id']
    readonly_fields = ['attempted_at']
    ordering = ['-attempted_at']

    def user_short(self, obj):
        return f"{obj.user.extension_id[:12]}..."
    user_short.short_description = 'User'


@admin.register(AccessLog)
class AccessLogAdmin(admin.ModelAdmin):
    list_display = [
        'user_short',
        'chatbot_name',
        'chatbot_url_short',
        'accessed_at',
        'problem_solved',
    ]
    list_filter = ['chatbot_name', 'accessed_at']
    search_fields = ['chatbot_name', 'chatbot_url', 'user__extension_id']
    readonly_fields = ['accessed_at']
    ordering = ['-accessed_at']

    def user_short(self, obj):
        return f"{obj.user.extension_id[:12]}..."
    user_short.short_description = 'User'

    def chatbot_url_short(self, obj):
        return f"{obj.chatbot_url[:50]}..."
    chatbot_url_short.short_description = 'URL'

    def problem_solved(self, obj):
        if obj.problem_solved_for_access:
            return obj.problem_solved_for_access.problem_title
        return '-'
    problem_solved.short_description = 'Problem Solved'


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = [
        'user_short',
        'session_start',
        'session_end',
        'is_active',
        'is_expired_display',
        'problem_attempt_title',
    ]
    list_filter = ['is_active', 'session_start']
    search_fields = ['user__extension_id']
    readonly_fields = ['session_start']
    ordering = ['-session_start']

    def user_short(self, obj):
        return f"{obj.user.extension_id[:12]}..."
    user_short.short_description = 'User'

    def is_expired_display(self, obj):
        return obj.is_expired()
    is_expired_display.short_description = 'Expired'
    is_expired_display.boolean = True

    def problem_attempt_title(self, obj):
        if obj.problem_attempt:
            return obj.problem_attempt.problem_title
        return '-'
    problem_attempt_title.short_description = 'Problem'
