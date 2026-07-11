from rest_framework import serializers
from .models import Subbar, Post, PostComment


class TeamMemberSerializer(serializers.Serializer):
    """吧务团队成员（吧主/吧务）的精简用户信息。"""
    id = serializers.IntegerField()
    username = serializers.CharField()


class SubbarSerializer(serializers.ModelSerializer):
    creator_name = serializers.SerializerMethodField()
    post_count = serializers.SerializerMethodField()
    managers = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = Subbar
        fields = ['id', 'name', 'description', 'created_by', 'creator_name',
                  'managers', 'is_owner', 'can_manage', 'post_count', 'created_at']
        read_only_fields = ['created_by', 'created_at']

    def get_creator_name(self, obj):
        return obj.created_by.username if obj.created_by else None

    def get_post_count(self, obj):
        return obj.posts.count()

    def get_managers(self, obj):
        return TeamMemberSerializer(obj.managers.all(), many=True).data

    def _user(self):
        request = self.context.get('request')
        return getattr(request, 'user', None) if request else None

    def get_is_owner(self, obj):
        user = self._user()
        return bool(user and user.is_authenticated and obj.created_by_id == user.id)

    def get_can_manage(self, obj):
        return obj.can_manage(self._user())


class PostCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = PostComment
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
        return PostCommentSerializer(qs, many=True, context=self.context).data


class PostListSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    subbar_name = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'subbar', 'subbar_name', 'title', 'content', 'author', 'author_name',
                  'comment_count', 'views', 'like_count', 'created_at']
        read_only_fields = ['subbar', 'author', 'views', 'created_at']

    def get_author_name(self, obj):
        return obj.author.username if obj.author else None

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_subbar_name(self, obj):
        return obj.subbar.name if obj.subbar_id else None


class PostDetailSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    subbar_name = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'subbar', 'subbar_name', 'title', 'content', 'author', 'author_name',
                  'comments', 'views', 'like_count', 'is_liked', 'can_manage', 'created_at']

    def get_can_manage(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        return obj.subbar.can_manage(user) if obj.subbar_id else False

    def get_author_name(self, obj):
        return obj.author.username if obj.author else None

    def get_subbar_name(self, obj):
        return obj.subbar.name if obj.subbar_id else None

    def get_comments(self, obj):
        qs = obj.comments.filter(parent=None)
        return PostCommentSerializer(qs, many=True, context=self.context).data

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False
