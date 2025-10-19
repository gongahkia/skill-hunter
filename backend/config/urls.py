"""
URL configuration for Dorso backend.
"""

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health_check(request):
    """Simple health check endpoint."""
    return JsonResponse({
        'status': 'healthy',
        'service': 'dorso-api',
        'version': '2.0.0'
    })


urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Health check
    path('health/', health_check, name='health'),

    # Prometheus metrics
    path('', include('django_prometheus.urls')),

    # API v1
    path('api/v1/users/', include('dorso_api.apps.tracking.urls')),
    path('api/v1/problems/', include('dorso_api.apps.problems.urls')),
]
