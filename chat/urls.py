from django.urls import path
from . import views

urlpatterns = [
    path('conversations/', views.conversation_list, name='conversation_list'),
    path('messages/', views.message_list, name='message_list'),
    path('users/', views.user_search, name='user_search'),
]
