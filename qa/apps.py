from django.apps import AppConfig


class QaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'qa'

    def ready(self):
        import OpenSHSID_backend.signals  # noqa: F401
