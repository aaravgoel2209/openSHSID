from django.db import models
from django.conf import settings


class Notice(models.Model):
    title = models.CharField(max_length=100, verbose_name="标题")
    content = models.TextField(blank=True, verbose_name="内容")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notices')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "公告"
        verbose_name_plural = "公告"
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    embedding = models.JSONField(null=True, blank=True, verbose_name="向量 (32维)")
    avatar = models.FileField(upload_to='avatars/', null=True, blank=True, verbose_name="头像")

    class Meta:
        verbose_name = "用户画像"
        verbose_name_plural = "用户画像"

    def __str__(self):
        return f"Profile: {self.user.username}"
