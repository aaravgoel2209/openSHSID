from django.db import models
from django.conf import settings
from django.utils import timezone

from OpenSHSID_backend.config_loader import cfg

_HEAT = cfg['ranking']['heat']


class Label(models.Model):
    name = models.CharField(max_length=50, unique=True, verbose_name="标签")

    class Meta:
        ordering = ['name']
        verbose_name = "标签"
        verbose_name_plural = "标签"

    def __str__(self):
        return self.name


class Question(models.Model):
    title = models.CharField(max_length=200, verbose_name="标题")
    content = models.TextField(verbose_name="内容")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, verbose_name="作者")
    views = models.PositiveIntegerField(default=0, verbose_name="浏览量")
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='liked_questions', verbose_name="点赞")
    labels = models.ManyToManyField('Label', blank=True, related_name='questions', verbose_name="标签")
    embedding = models.JSONField(null=True, blank=True, verbose_name="向量 (32维)")
    source_lang = models.CharField(max_length=2, blank=True, verbose_name="原文语言")  # 'zh' / 'en'
    title_translated = models.CharField(max_length=400, blank=True, verbose_name="标题译文")
    content_translated = models.TextField(blank=True, verbose_name="内容译文")
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
        days = (timezone.now() - self.created_at).days
        # 权重集中在 config.json ranking.heat（与知识库/周榜共用同一份）
        h = _HEAT
        return round(max(0.0, h['initial'] + clicks * h['click'] + likes * h['like']
                         + comments * h['comment'] - days * h['decay']), 4)

    def __str__(self):
        return self.title


class Answer(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answers', verbose_name="所属问题")
    content = models.TextField(verbose_name="回答内容")
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies', verbose_name="回复目标")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, verbose_name="作者")
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='liked_answers', verbose_name="点赞")
    is_streaming = models.BooleanField(default=False, verbose_name="生成中")  # Rei 流式回答进行中
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ['created_at']
        verbose_name = "回答"
        verbose_name_plural = "回答"

    def __str__(self):
        return f"回答 {self.id}: {self.content[:50]}"
