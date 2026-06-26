from urllib.parse import quote

from rest_framework import serializers
from .models import Course, Section, Activity


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ["id", "modtype", "cmid", "title", "url", "restricted", "order"]


class SectionSerializer(serializers.ModelSerializer):
    activities = ActivitySerializer(many=True, read_only=True)
    photo_proxy_url = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = ["id", "title", "url", "photo_url", "photo_proxy_url", "tile_icon", "order", "activities"]

    def get_photo_proxy_url(self, obj):
        if not obj.photo_url:
            return ""
        return f"/api/crawler/image-proxy/?url={quote(obj.photo_url, safe='')}"


class CourseSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = ["id", "course_id", "title", "summary", "last_synced", "sections"]


class CourseListSerializer(serializers.ModelSerializer):
    section_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "course_id", "title", "summary", "last_synced", "section_count"]

    def get_section_count(self, obj):
        return obj.sections.count()
