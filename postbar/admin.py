from django.contrib import admin
from .models import Subbar, Post, PostComment


@admin.register(Subbar)
class SubbarAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_by', 'created_at']
    search_fields = ['name', 'description']
    filter_horizontal = ['managers']


class PostCommentInline(admin.TabularInline):
    model = PostComment
    extra = 0


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['title', 'subbar', 'author', 'views', 'created_at']
    list_filter = ['subbar']
    search_fields = ['title', 'content']
    inlines = [PostCommentInline]


@admin.register(PostComment)
class PostCommentAdmin(admin.ModelAdmin):
    list_display = ['post', 'content', 'author', 'created_at']
