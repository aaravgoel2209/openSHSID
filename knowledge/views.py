from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db import models as django_models
from .models import Article, Grade, Subject
from .serializers import (
    GradeSerializer, SubjectSerializer,
    ArticleListSerializer, ArticleDetailSerializer,
)


@api_view(['GET'])
def grade_list(request):
    grades = Grade.objects.all()
    serializer = GradeSerializer(grades, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def subject_list(request):
    subjects = Subject.objects.all()
    serializer = SubjectSerializer(subjects, many=True)
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def article_list(request):
    if request.method == 'GET':
        articles = Article.objects.all()
        grade = request.query_params.get('grade')
        subject = request.query_params.get('subject')
        if grade:
            articles = articles.filter(grade_id=grade)
        if subject:
            articles = articles.filter(subject_id=subject)
        serializer = ArticleListSerializer(articles, many=True)
        return Response(serializer.data)

    if request.method == 'POST':
        serializer = ArticleDetailSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(
                author=request.user if request.user.is_authenticated else None,
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def article_detail(request, pk):
    article = get_object_or_404(Article, pk=pk)
    serializer = ArticleDetailSerializer(article)
    return Response(serializer.data)


@api_view(['POST'])
def view_article(request, pk):
    Article.objects.filter(pk=pk).update(views=django_models.F('views') + 1)
    return Response({'ok': True})
