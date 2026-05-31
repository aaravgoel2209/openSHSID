from django.db import models
from django.conf import settings


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
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, verbose_name="年级")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, verbose_name="学科")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, verbose_name="作者")
    author_name = models.CharField(max_length=100, blank=True, verbose_name="作者名")
    views = models.PositiveIntegerField(default=0, verbose_name="浏览量")
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='liked_articles', verbose_name="点赞")
    embedding = models.JSONField(null=True, blank=True, verbose_name="向量 (32维)")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ['-created_at']
        verbose_name = "文章"
        verbose_name_plural = "文章"

    @property
    def heat(self):
        clicks = self.views
        likes = self.likes.count()
        return round(max(0.0, 2.0 + clicks * 0.1 + likes * 0.3), 4)

    def __str__(self):
        return self.title
