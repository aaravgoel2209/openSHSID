from rest_framework import serializers
from .models import Question, Answer


class AnswerSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Answer
        fields = ['id', 'content', 'author', 'author_name', 'created_at']
        read_only_fields = ['author', 'created_at']

    def get_author_name(self, obj):
        return obj.author.username if obj.author else None


class QuestionListSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    answer_count = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ['id', 'title', 'author', 'author_name', 'answer_count', 'views', 'created_at']

    def get_author_name(self, obj):
        return obj.author.username if obj.author else None

    def get_answer_count(self, obj):
        return obj.answers.count()


class QuestionDetailSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    answers = AnswerSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'title', 'content', 'author', 'author_name', 'answers', 'views', 'embedding', 'created_at']

    def get_author_name(self, obj):
        return obj.author.username if obj.author else None
