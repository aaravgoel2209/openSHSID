from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'type', 'title', 'message', 'link', 'is_read',
                  'actor', 'actor_name', 'created_at']

    def get_actor_name(self, obj):
        return obj.actor.username if obj.actor else None
