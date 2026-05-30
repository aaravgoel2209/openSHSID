from django.urls import path
from . import views

urlpatterns = [
    path('grades/', views.grade_list, name='grade_list'),
    path('subjects/', views.subject_list, name='subject_list'),
    path('articles/', views.article_list, name='article_list'),
    path('articles/<int:pk>/', views.article_detail, name='article_detail'),
]
