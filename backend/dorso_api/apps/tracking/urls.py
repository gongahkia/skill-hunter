"""
URL configuration for tracking app.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ExtensionUserViewSet,
    RegisterUserView,
    CheckSessionView,
    LogAccessView,
)

router = DefaultRouter()
router.register(r'', ExtensionUserViewSet, basename='users')

urlpatterns = [
    # Registration and session checking
    path('register/', RegisterUserView.as_view(), name='register'),
    path('check-session/', CheckSessionView.as_view(), name='check-session'),
    path('log-access/', LogAccessView.as_view(), name='log-access'),

    # User viewset routes
    path('', include(router.urls)),
]
