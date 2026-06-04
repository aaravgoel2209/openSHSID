from rest_framework import serializers
from qa.serializers import LabelSerializer
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
    like_count = serializers.SerializerMethodField()
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Article
        fields = ['id', 'title', 'grade', 'grade_name', 'subject', 'subject_name',
                  'author_name_display', 'views', 'like_count', 'labels', 'embedding', 'created_at']

    def get_author_name_display(self, obj):
        if obj.author:
            return obj.author.username
        return obj.author_name or ''

    def get_like_count(self, obj):
        return obj.likes.count()


class ArticleDetailSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    author_name_display = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    heat = serializers.SerializerMethodField()
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Article
        fields = ['id', 'title', 'content', 'grade', 'grade_name', 'subject', 'subject_name',
                  'author', 'author_name', 'author_name_display', 'views', 'like_count', 'is_liked',
                  'heat', 'labels', 'embedding', 'created_at']
        read_only_fields = ['author', 'created_at']

    def get_author_name_display(self, obj):
        if obj.author:
            return obj.author.username
        return obj.author_name or ''

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def get_heat(self, obj):
        request = self.context.get('request')
        if request and request.user.is_staff:
            return obj.heat
        return None
