from django.urls import path
from . import views

urlpatterns = [
    path('questions/', views.question_list, name='question_list'),
    path('questions/<int:pk>/', views.question_detail, name='question_detail'),
    path('questions/<int:pk>/view/', views.view_question, name='view_question'),
    path('questions/<int:pk>/like/', views.like_question, name='like_question'),
    path('questions/<int:pk>/answers/', views.answer_list, name='answer_list'),
    path('answers/<int:pk>/like/', views.like_answer, name='like_answer'),
]
