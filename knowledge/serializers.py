from rest_framework import serializers
from .models import Grade, Subject, Article


class GradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ['id', 'name']


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name']


class ArticleListSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    author_name_display = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = ['id', 'title', 'grade', 'grade_name', 'subject', 'subject_name',
                  'author_name_display', 'views', 'created_at']

    def get_author_name_display(self, obj):
        if obj.author:
            return obj.author.username
        return obj.author_name or ''


class ArticleDetailSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    author_name_display = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = ['id', 'title', 'content', 'grade', 'grade_name', 'subject', 'subject_name',
                  'author', 'author_name', 'author_name_display', 'views', 'embedding', 'created_at']
        read_only_fields = ['author', 'created_at']

    def get_author_name_display(self, obj):
        if obj.author:
            return obj.author.username
        return obj.author_name or ''
