from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db import models as django_models
from django.db.models import Q
from .models import Label, Question, Answer
from .serializers import LabelSerializer, QuestionListSerializer, QuestionDetailSerializer, AnswerSerializer


@api_view(['GET'])
def label_list(request):
    labels = Label.objects.all()
    return Response(LabelSerializer(labels, many=True).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def question_list(request):
    if request.method == 'GET':
        questions = Question.objects.all()
        q = request.query_params.get('search')
        if q:
            questions = questions.filter(Q(title__icontains=q) | Q(content__icontains=q))
        serializer = QuestionListSerializer(questions, many=True)
        return Response(serializer.data)

    if request.method == 'POST':
        serializer = QuestionListSerializer(data=request.data)
        if serializer.is_valid():
            label_ids = request.data.get('labels', [])
            q = serializer.save(author=request.user if request.user.is_authenticated else None)
            if label_ids:
                q.labels.set(Label.objects.filter(id__in=label_ids))
            return Response(QuestionDetailSerializer(q, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def question_detail(request, pk):
    question = get_object_or_404(Question, pk=pk)
    serializer = QuestionDetailSerializer(question, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def like_question(request, pk):
    question = get_object_or_404(Question, pk=pk)
    if question.likes.filter(id=request.user.id).exists():
        question.likes.remove(request.user)
    else:
        question.likes.add(request.user)
    return Response({'liked': question.likes.filter(id=request.user.id).exists(), 'count': question.likes.count()})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def like_answer(request, pk):
    answer = get_object_or_404(Answer, pk=pk)
    if answer.likes.filter(id=request.user.id).exists():
        answer.likes.remove(request.user)
    else:
        answer.likes.add(request.user)
    return Response({'liked': answer.likes.filter(id=request.user.id).exists(), 'count': answer.likes.count()})


@api_view(['POST'])
def view_question(request, pk):
    Question.objects.filter(pk=pk).update(views=django_models.F('views') + 1)
    return Response({'ok': True})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def answer_list(request, pk):
    question = get_object_or_404(Question, pk=pk)
    if request.method == 'GET':
        answers = question.answers.filter(parent=None)
        serializer = AnswerSerializer(answers, many=True, context={'request': request})
        return Response(serializer.data)

    if request.method == 'POST':
        serializer = AnswerSerializer(data=request.data)
        if serializer.is_valid():
            parent_id = request.data.get('parent')
            if parent_id:
                parent = get_object_or_404(Answer, pk=parent_id, question=question)
            serializer.save(
                question=question,
                author=request.user if request.user.is_authenticated else None,
                parent=parent if parent_id else None,
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
