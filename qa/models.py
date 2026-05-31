from django.db import models
from django.conf import settings


class Question(models.Model):
    title = models.CharField(max_length=200, verbose_name="标题")
    content = models.TextField(verbose_name="内容")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, verbose_name="作者")
    views = models.PositiveIntegerField(default=0, verbose_name="浏览量")
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='liked_questions', verbose_name="点赞")
    embedding = models.JSONField(null=True, blank=True, verbose_name="向量 (32维)")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ['-created_at']
        verbose_name = "问题"
        verbose_name_plural = "问题"

    @property
    def heat(self):
        clicks = self.views
        likes = self.likes.count()
        comments = self.answers.count()
        return round(max(0.0, 2.0 + clicks * 0.1 + likes * 0.3 + comments * 0.2), 4)

    def __str__(self):
        return self.title


class Answer(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answers', verbose_name="所属问题")
    content = models.TextField(verbose_name="回答内容")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, verbose_name="作者")
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='liked_answers', verbose_name="点赞")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ['created_at']
        verbose_name = "回答"
        verbose_name_plural = "回答"

    def __str__(self):
        return f"回答 {self.id}: {self.content[:50]}"
