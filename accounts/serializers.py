from rest_framework import serializers
from django.contrib.auth.models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    embedding = serializers.SerializerMethodField()
    article_count = serializers.SerializerMethodField()
    answer_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'date_joined', 'is_staff', 'embedding', 'article_count', 'answer_count']

    def get_article_count(self, obj):
        return obj.article_set.count()

    def get_answer_count(self, obj):
        return obj.answer_set.count()

    def get_embedding(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and (request.user.is_staff or request.user == obj):
            profile = getattr(obj, 'profile', None)
            if profile and profile.embedding:
                return {'vector': profile.embedding, 'dim': len(profile.embedding)}
        return None
