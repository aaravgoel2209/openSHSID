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
    question_count = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'date_joined', 'is_staff', 'embedding', 'article_count', 'answer_count', 'question_count', 'avatar']

    def get_article_count(self, obj):
        return obj.article_set.count()

    def get_answer_count(self, obj):
        return obj.answer_set.count()

    def get_question_count(self, obj):
        return obj.question_set.count()

    def get_avatar(self, obj):
        # 返回根相对路径（/media/...），不用 build_absolute_uri：后者会把请求里看到的
        # Host 写进 URL。前端经 Vite 代理（changeOrigin）或反代访问时，那个 Host 是
        # localhost:19424 之类的内部地址，导致网页端去请求 localhost 而非服务器。
        # 相对路径交给浏览器按 SPA 所在源解析；Cordova 端再由 resolveAvatar 挂到公网域名。
        profile = getattr(obj, 'profile', None)
        if profile and profile.avatar:
            return profile.avatar.url
        return None

    def get_embedding(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and (request.user.is_staff or request.user == obj):
            profile = getattr(obj, 'profile', None)
            if profile and profile.embedding:
                return {'vector': profile.embedding, 'dim': len(profile.embedding)}
        return None
