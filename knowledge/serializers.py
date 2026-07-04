from rest_framework import serializers
from qa.serializers import LabelSerializer
from .models import Grade, Subject, Article, Comment


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'parent', 'content', 'author', 'author_name', 'like_count', 'is_liked', 'replies', 'created_at']
        read_only_fields = ['author', 'created_at']

    def get_author_name(self, obj):
        return obj.author.username if obj.author else None

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def get_replies(self, obj):
        qs = obj.replies.all()
        return CommentSerializer(qs, many=True, context=self.context).data


class GradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ['id', 'name']


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name']


class ArticleListSerializer(serializers.ModelSerializer):
    grade_name = serializers.SerializerMethodField()
    subject_name = serializers.SerializerMethodField()
    author_name_display = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Article
        fields = ['id', 'title', 'grade', 'grade_name', 'subject', 'subject_name',
                  'author_name_display', 'views', 'like_count', 'comment_count', 'labels', 'embedding',
                  'source_lang', 'title_translated', 'created_at']

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_grade_name(self, obj):
        return obj.grade.name if obj.grade else None

    def get_subject_name(self, obj):
        return obj.subject.name if obj.subject else None

    def get_author_name_display(self, obj):
        if obj.author:
            return obj.author.username
        return obj.author_name or ''

    def get_like_count(self, obj):
        return obj.likes.count()


class ArticleDetailSerializer(serializers.ModelSerializer):
    grade_name = serializers.SerializerMethodField()
    subject_name = serializers.SerializerMethodField()
    author_name_display = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    heat = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Article
        fields = ['id', 'title', 'content', 'grade', 'grade_name', 'subject', 'subject_name',
                  'author', 'author_name', 'author_name_display', 'views', 'like_count', 'is_liked',
                  'heat', 'comments', 'labels', 'embedding',
                  'source_lang', 'title_translated', 'content_translated', 'created_at']
        read_only_fields = ['author', 'created_at']

    def get_comments(self, obj):
        qs = obj.comments.filter(parent=None)
        return CommentSerializer(qs, many=True, context=self.context).data

    def get_grade_name(self, obj):
        return obj.grade.name if obj.grade else None

    def get_subject_name(self, obj):
        return obj.subject.name if obj.subject else None

    def get_author_name_display(self, obj):
        if obj.author:
            return obj.author.username
        return obj.author_name or ''

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def get_heat(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and request.user.is_staff:
            return obj.heat
        return None
