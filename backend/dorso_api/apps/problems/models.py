"""
Models for problem management (minimal - most data comes from LeetCode API).
"""

from django.db import models

# This app primarily uses the LeetCode GraphQL API and Redis cache.
# We don't need to persist problems in the database since they're fetched on-demand.
# The tracking app handles ProblemAttempt records.
