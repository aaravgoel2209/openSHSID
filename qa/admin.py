from django.contrib import admin
from .models import Label, Question, Answer


@admin.register(Label)
class LabelAdmin(admin.ModelAdmin):
    list_display = ['name']


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 0


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['title', 'created_at', 'views']
    readonly_fields = ['embedding_display']
    inlines = [AnswerInline]

    @admin.display(description="向量 (32维)")
    def embedding_display(self, obj):
        if not obj.embedding:
            return "-"
        return f"[{', '.join(f'{x:.4f}' for x in obj.embedding[:4])} ...] ({len(obj.embedding)}维)"


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ['question', 'content', 'created_at']
