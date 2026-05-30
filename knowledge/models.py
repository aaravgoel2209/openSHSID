from django.db import models


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
    author_name = models.CharField(max_length=100, blank=True, verbose_name="作者")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ['-created_at']
        verbose_name = "文章"
        verbose_name_plural = "文章"

    def __str__(self):
        return self.title
