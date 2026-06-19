from django.db import models
from django.conf import settings


class Notification(models.Model):
    """系统通知 / 信箱条目"""
    TYPE_CHOICES = [
        ('answer', '回答'),
        ('reply', '回复'),
        ('like', '点赞'),
        ('message', '私信'),
        ('system', '系统'),
    ]

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                  related_name='notifications', verbose_name='接收者')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                              on_delete=models.SET_NULL, related_name='+', verbose_name='触发者')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='system', verbose_name='类型')
    title = models.CharField(max_length=200, verbose_name='标题')
    message = models.TextField(blank=True, verbose_name='内容')
    link = models.CharField(max_length=300, blank=True, verbose_name='跳转链接')
    is_read = models.BooleanField(default=False, verbose_name='已读')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='时间')

    class Meta:
        ordering = ['-created_at']
        verbose_name = '通知'
        verbose_name_plural = '通知'
        indexes = [models.Index(fields=['recipient', 'is_read'])]

    def __str__(self):
        return f'{self.recipient} ← {self.title}'
