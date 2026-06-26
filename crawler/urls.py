from django.urls import path
from . import views

urlpatterns = [
    path("credentials/", views.credentials, name="crawler_credentials"),
    path("sync/", views.sync, name="crawler_sync"),
    path("courses/", views.course_list, name="crawler_course_list"),
    path("courses/<str:course_id>/", views.course_detail, name="crawler_course_detail"),
    path("image-proxy/", views.image_proxy, name="crawler_image_proxy"),
    path("download/", views.download_resource, name="crawler_download"),
    path("browser-login/", views.browser_login, name="crawler_browser_login"),
    path("clear-cache/", views.clear_session_cache, name="crawler_clear_cache"),
]
