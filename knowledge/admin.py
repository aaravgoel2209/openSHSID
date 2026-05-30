from django.contrib import admin
from .models import Grade, Subject, Article


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ['name']


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['name']


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ['title', 'grade', 'subject', 'created_at']
    list_filter = ['grade', 'subject']
