from django.db import models
from django.conf import settings


class Message(models.Model):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages', verbose_name="发送者")
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_messages', verbose_name="接收者")
    content = models.TextField(verbose_name="内容")
    is_read = models.BooleanField(default=False, verbose_name="已读")  # 仅对接收方有意义
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="发送时间")

    class Meta:
        ordering = ['-created_at']
        verbose_name = "消息"
        verbose_name_plural = "消息"
        indexes = [
            models.Index(fields=['recipient', 'is_read']),  # 会话列表未读计数
        ]

    def __str__(self):
        return f"{self.sender} → {self.recipient}: {self.content[:30]}"
