from django.db import models
from django.conf import settings


class Subbar(models.Model):
    """子吧（类似 subreddit）：一个话题版块，用户在里面发帖。"""
    name = models.CharField(max_length=50, unique=True, verbose_name="吧名")
    description = models.CharField(max_length=200, blank=True, verbose_name="简介")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='created_subbars', verbose_name="吧主",
    )
    managers = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True,
        related_name='managed_subbars', verbose_name="吧务",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ['name']
        verbose_name = "子吧"
        verbose_name_plural = "子吧"

    def __str__(self):
        return self.name

    def can_manage(self, user):
        """吧主、吧务、站点管理员可管理本吧（删帖/删回复/任免吧务）。"""
        if not (user and user.is_authenticated):
            return False
        if user.is_staff or self.created_by_id == user.id:
            return True
        return self.managers.filter(id=user.id).exists()


class Post(models.Model):
    """帖子：发布在某个子吧下。"""
    subbar = models.ForeignKey(Subbar, on_delete=models.CASCADE, related_name='posts', verbose_name="所属吧")
    title = models.CharField(max_length=200, verbose_name="标题")
    content = models.TextField(verbose_name="内容")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='posts', verbose_name="作者",
    )
    views = models.PositiveIntegerField(default=0, verbose_name="浏览量")
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='liked_posts', verbose_name="点赞")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ['-created_at']
        verbose_name = "帖子"
        verbose_name_plural = "帖子"

    def __str__(self):
        return self.title


class PostComment(models.Model):
    """帖子回复，支持一层嵌套（parent 指向被回复的评论）。"""
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments', verbose_name="所属帖子")
    content = models.TextField(verbose_name="回复内容")
    parent = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.CASCADE, related_name='replies', verbose_name="回复目标",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='post_comments', verbose_name="作者",
    )
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='liked_post_comments', verbose_name="点赞")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ['created_at']
        verbose_name = "帖子回复"
        verbose_name_plural = "帖子回复"

    def __str__(self):
        return f"回复 {self.id}: {self.content[:50]}"
