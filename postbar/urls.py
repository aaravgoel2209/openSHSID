from django.urls import path
from . import views

urlpatterns = [
    # 子吧
    path('subbars/', views.subbar_list, name='subbar_list'),
    path('subbars/<int:pk>/', views.subbar_detail, name='subbar_detail'),
    path('subbars/<int:pk>/managers/', views.subbar_managers, name='subbar_managers'),
    path('subbars/<int:pk>/posts/', views.subbar_posts, name='subbar_posts'),

    # 帖子
    path('posts/<int:pk>/', views.post_detail, name='post_detail'),
    path('posts/<int:pk>/view/', views.view_post, name='view_post'),
    path('posts/<int:pk>/like/', views.like_post, name='like_post'),
    path('posts/<int:pk>/comments/', views.post_comments, name='post_comments'),

    # 回复
    path('comments/<int:pk>/like/', views.like_comment, name='like_comment'),
]
