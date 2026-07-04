from django.urls import path
from . import views
from . import memory_api

urlpatterns = [
    path('grades/', views.grade_list, name='grade_list'),
    path('subjects/', views.subject_list, name='subject_list'),
    path('articles/', views.article_list, name='article_list'),
    path('articles/<int:pk>/', views.article_detail, name='article_detail'),
    path('articles/<int:pk>/view/', views.view_article, name='view_article'),

    path('articles/<int:pk>/like/', views.like_article, name='like_article'),
    path('articles/<int:pk>/comments/', views.comment_list, name='comment_list'),
    path('comments/<int:pk>/like/', views.like_comment, name='like_comment'),
    path('memory/', memory_api.memory_list, name='memory_list'),
]
