from django.urls import path
from . import views

urlpatterns = [
    path('', views.notification_list, name='notification_list'),
    path('unread-count/', views.unread_count, name='notification_unread_count'),
    path('read-all/', views.mark_all_read, name='notification_read_all'),
    path('clear/', views.clear_all, name='notification_clear'),
    path('<int:pk>/read/', views.mark_read, name='notification_mark_read'),
]
