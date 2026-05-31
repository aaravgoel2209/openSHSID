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
    list_display = ['title', 'grade', 'subject', 'created_at', 'views']
    list_filter = ['grade', 'subject']
    readonly_fields = ['embedding_display']

    @admin.display(description="向量 (32维)")
    def embedding_display(self, obj):
        if not obj.embedding:
            return "-"
        return f"[{', '.join(f'{x:.4f}' for x in obj.embedding[:4])} ...] ({len(obj.embedding)}维)"
