from rest_framework import serializers
from .models import Label, Question, Answer


class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ['id', 'name']


class AnswerSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Answer
        fields = ['id', 'parent', 'content', 'author', 'author_name', 'like_count', 'is_liked', 'replies', 'created_at']
        read_only_fields = ['author', 'created_at']

    def get_author_name(self, obj):
        return obj.author.username if obj.author else None

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def get_replies(self, obj):
        qs = obj.replies.all()
        return AnswerSerializer(qs, many=True, context=self.context).data


class QuestionListSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    answer_count = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'title', 'content', 'author', 'author_name', 'answer_count', 'views', 'like_count', 'labels', 'created_at']

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_author_name(self, obj):
        return obj.author.username if obj.author else None

    def get_answer_count(self, obj):
        return obj.answers.count()


class QuestionDetailSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    answers = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    heat = serializers.SerializerMethodField()
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'title', 'content', 'author', 'author_name', 'answers', 'views', 'like_count', 'is_liked', 'heat', 'labels', 'embedding', 'created_at']

    def get_answers(self, obj):
        qs = obj.answers.filter(parent=None)
        return AnswerSerializer(qs, many=True, context=self.context).data

    def get_author_name(self, obj):
        return obj.author.username if obj.author else None

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
