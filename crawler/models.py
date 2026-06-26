from django.db import models


class Credential(models.Model):
    """Per-user LinkedClassroom credentials. Any logged-in user can store their own."""
    user = models.OneToOneField(
        "auth.User", on_delete=models.CASCADE, related_name="lc_credential"
    )
    username = models.CharField(max_length=100)
    password = models.CharField(max_length=100)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "LinkedClassroom 凭据"

    def __str__(self):
        return f"LC credential: {self.username} ({self.user.username})"


class Course(models.Model):
    course_id = models.CharField(max_length=20, unique=True, verbose_name="课程ID")
    title = models.CharField(max_length=255, verbose_name="课程名称")
    summary = models.TextField(blank=True, verbose_name="课程简介")
    last_synced = models.DateTimeField(auto_now=True, verbose_name="最后同步时间")

    class Meta:
        verbose_name = "课程"
        verbose_name_plural = "课程"
        ordering = ["title"]

    def __str__(self):
        return f"{self.course_id} — {self.title}"


class Section(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="sections", verbose_name="课程")
    title = models.CharField(max_length=255, verbose_name="章节名称")
    url = models.URLField(max_length=500, blank=True, verbose_name="章节链接")
    photo_url = models.URLField(max_length=1000, blank=True, verbose_name="封面图")
    tile_icon = models.CharField(max_length=60, blank=True, verbose_name="图标类名")
    order = models.PositiveIntegerField(default=0, verbose_name="排序")

    class Meta:
        verbose_name = "章节"
        verbose_name_plural = "章节"
        ordering = ["order"]

    def __str__(self):
        return f"{self.course.title} › {self.title}"


class Activity(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="activities", verbose_name="章节")
    modtype = models.CharField(max_length=50, blank=True, verbose_name="类型")
    cmid = models.CharField(max_length=20, blank=True, verbose_name="CMID")
    title = models.CharField(max_length=255, blank=True, verbose_name="标题")
    url = models.URLField(max_length=500, blank=True, verbose_name="链接")
    restricted = models.BooleanField(default=False, verbose_name="受限")
    order = models.PositiveIntegerField(default=0, verbose_name="排序")

    class Meta:
        verbose_name = "活动"
        verbose_name_plural = "活动"
        ordering = ["order"]

    def __str__(self):
        return f"{self.modtype}: {self.title}"
