from django.db import models
from django.conf import settings


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    embedding = models.JSONField(null=True, blank=True, verbose_name="向量 (32维)")

    class Meta:
        verbose_name = "用户画像"
        verbose_name_plural = "用户画像"

    def __str__(self):
        return f"Profile: {self.user.username}"
