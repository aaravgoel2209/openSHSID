from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/qa/', include('qa.urls')),
    path('api/knowledge/', include('knowledge.urls')),
    path('api/auth/', include('accounts.urls')),
    path('api/chat/', include('chat.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/crawler/', include('crawler.urls')),
    path('api/postbar/', include('postbar.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
