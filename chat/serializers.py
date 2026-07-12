from rest_framework import serializers
from .models import Message


def _avatar_url(user, request=None):
    # 根相对路径即可（见 accounts.serializers.get_avatar 的说明）；request 参数保留
    # 以兼容既有调用点，但不再用它拼绝对地址。
    profile = getattr(user, 'profile', None)
    if profile and profile.avatar:
        return profile.avatar.url
    return None


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    sender_avatar = serializers.SerializerMethodField()
    recipient_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'sender', 'sender_name', 'sender_avatar',
            'recipient', 'recipient_name', 'recipient_avatar',
            'content', 'created_at',
        ]
        read_only_fields = ['sender', 'created_at']

    def get_sender_name(self, obj):
        return obj.sender.username

    def get_recipient_name(self, obj):
        return obj.recipient.username

    def get_sender_avatar(self, obj):
        return _avatar_url(obj.sender, self.context.get('request'))

    def get_recipient_avatar(self, obj):
        return _avatar_url(obj.recipient, self.context.get('request'))


class ConversationSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    avatar = serializers.CharField(allow_null=True, required=False, default=None)
    last_message = serializers.CharField()
    last_message_at = serializers.DateTimeField()
    unread = serializers.BooleanField(default=False)
