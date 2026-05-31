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

    class Meta:
        model = User
        fields = ['id', 'username', 'date_joined', 'embedding']

    def get_embedding(self, obj):
        request = self.context.get('request')
        if request and request.user.is_staff:
            profile = getattr(obj, 'profile', None)
            if profile and profile.embedding:
                return {'vector': profile.embedding[:4], 'dim': len(profile.embedding)}
        return None
