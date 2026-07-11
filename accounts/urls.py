from django.urls import path
from . import views, admin_views

urlpatterns = [
    path('login/', views.LoginView.as_view(), name='login'),
    path('register/', views.register, name='register'),
    path('profile/', views.profile, name='profile'),
    path('users/<int:user_id>/', views.public_profile, name='public_profile'),
    path('admin/dashboard/', admin_views.admin_dashboard, name='admin_dashboard'),
    path('admin/users/', admin_views.admin_users, name='admin_users'),
    path('admin/users/<int:user_id>/', admin_views.admin_user_detail, name='admin_user_detail'),
    path('admin/content/', admin_views.admin_content, name='admin_content'),
    path('admin/content/<str:kind>/<int:obj_id>/', admin_views.admin_content_delete, name='admin_content_delete'),
    path('notices/', views.notices, name='notices'),
    path('notices/<int:notice_id>/', views.notice_detail, name='notice_detail'),
    path('weekly-top/', views.weekly_top_users, name='weekly_top_users'),
    path('avatar/upload/', views.upload_avatar, name='upload_avatar'),
]
