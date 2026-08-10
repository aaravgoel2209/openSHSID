from django.db import models
from django.conf import settings
from django.utils import timezone

from OpenSHSID_backend.config_loader import cfg

_HEAT = cfg['ranking']['heat']


class Grade(models.Model):
    name = models.CharField(max_length=50, unique=True, verbose_name="年级")

    class Meta:
        ordering = ['name']
        verbose_name = "年级"
        verbose_name_plural = "年级"

    def __str__(self):
        return self.name


class Subject(models.Model):
    name = models.CharField(max_length=50, unique=True, verbose_name="学科")

    class Meta:
        ordering = ['name']
        verbose_name = "学科"
        verbose_name_plural = "学科"

    def __str__(self):
        return self.name


class Article(models.Model):
    title = models.CharField(max_length=200, verbose_name="标题")
    content = models.TextField(verbose_name="内容")
    grade = models.ForeignKey(Grade, null=True, blank=True, on_delete=models.SET_NULL, verbose_name="年级")
    subject = models.ForeignKey(Subject, null=True, blank=True, on_delete=models.SET_NULL, verbose_name="学科")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, verbose_name="作者")
    author_name = models.CharField(max_length=100, blank=True, verbose_name="作者名")
    views = models.PositiveIntegerField(default=0, verbose_name="浏览量")
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='liked_articles', verbose_name="点赞")
    labels = models.ManyToManyField('qa.Label', blank=True, related_name='articles', verbose_name="标签")
    embedding = models.JSONField(null=True, blank=True, verbose_name="向量 (32维)")
    source_lang = models.CharField(max_length=2, blank=True, verbose_name="原文语言")  # 'zh' / 'en'
    title_translated = models.CharField(max_length=400, blank=True, verbose_name="标题译文")
    content_translated = models.TextField(blank=True, verbose_name="内容译文")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ['-created_at']
        verbose_name = "文章"
        verbose_name_plural = "文章"

    @property
    def heat(self):
        clicks = self.views
        likes = self.likes.count()
        comments = self.comments.count()
        days = (timezone.now() - self.created_at).days
        # 权重集中在 config.json ranking.heat（与问答/周榜共用同一份）
        h = _HEAT
        return round(max(0.0, h['initial'] + clicks * h['click'] + likes * h['like']
                         + comments * h['comment'] - days * h['decay']), 4)

    def __str__(self):
        return self.title


class Comment(models.Model):
    """文章评论/回复（结构对齐 qa.Answer：支持嵌套回复与点赞）"""
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='comments', verbose_name="所属文章")
    content = models.TextField(verbose_name="评论内容")
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies', verbose_name="回复目标")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, verbose_name="作者")
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='liked_comments', verbose_name="点赞")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ['created_at']
        verbose_name = "评论"
        verbose_name_plural = "评论"

    def __str__(self):
        return f"评论 {self.id}: {self.content[:50]}"
