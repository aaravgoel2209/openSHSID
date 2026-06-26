from django.contrib import admin
from .models import Course, Section, Activity, Credential


@admin.register(Credential)
class CredentialAdmin(admin.ModelAdmin):
    list_display = ["user", "username", "updated_at"]


class SectionInline(admin.TabularInline):
    model = Section
    extra = 0
    show_change_link = True


class ActivityInline(admin.TabularInline):
    model = Activity
    extra = 0


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ["course_id", "title", "last_synced"]
    inlines = [SectionInline]


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ["course", "title", "order"]
    inlines = [ActivityInline]


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ["section", "modtype", "title", "restricted"]
