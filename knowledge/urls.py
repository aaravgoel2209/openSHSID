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
    # 【占位】文档 OCR → 知识库（上传 PDF/图片，OCR 成 Markdown；LC 拉取 + AI 摘要后续接入）
    path('ocr-import/', views.ocr_import, name='ocr_import'),
    # 工具箱·OCR 扫描：识别 → 勾选区域 → 主聊天模型摘要 / 存入知识库
    path('ocr-scan/', views.ocr_scan, name='ocr_scan'),
    path('ocr-summarize/', views.ocr_summarize, name='ocr_summarize'),
    path('ocr-save/', views.ocr_save, name='ocr_save'),
]
