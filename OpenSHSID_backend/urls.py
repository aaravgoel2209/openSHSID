from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect

urlpatterns = [
    path('admin/', admin.site.urls),
    path('qa/', include('qa.urls')),
    path('knowledge/', include('knowledge.urls')),
    path('', lambda request: redirect('question_list')),
]
