from django.apps import AppConfig


class TrackingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dorso_api.apps.tracking'
    verbose_name = 'User Tracking'

    def ready(self):
        """Import signals when app is ready."""
        import dorso_api.apps.tracking.signals  # noqa: F401
