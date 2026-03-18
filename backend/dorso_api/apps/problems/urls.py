"""
URL configuration for problems app.
"""

from django.urls import path
from .views import (
    RandomProblemView,
    SubmitSolutionView,
    LogAttemptView,
    VerifyCodeforcesView,
    PracticeDeckView,
    fetch_problem_by_slug,
    refill_problem_queue,
)

urlpatterns = [
    path('random/', RandomProblemView.as_view(), name='random-problem'),
    path('submit/', SubmitSolutionView.as_view(), name='submit-solution'),
    path('attempt/', LogAttemptView.as_view(), name='log-attempt'),
    path('verify-codeforces/', VerifyCodeforcesView.as_view(), name='verify-codeforces'),
    path('practice-deck/', PracticeDeckView.as_view(), name='practice-deck'),
    path('refill-queue/', refill_problem_queue, name='refill-queue'),
    path('<str:slug>/', fetch_problem_by_slug, name='fetch-problem'),
]
