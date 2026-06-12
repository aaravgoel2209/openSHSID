import re
import threading
import requests
import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db import models as django_models
from django.db.models import Q
from django.contrib.auth.models import User
from django.conf import settings as django_settings

from .models import Label, Question, Answer
from .serializers import LabelSerializer, QuestionListSerializer, QuestionDetailSerializer, AnswerSerializer

logger = logging.getLogger(__name__)


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


def _get_rei_user():
    user, created = User.objects.get_or_create(
        username='Rei',
        defaults={'is_active': True},
    )
    if created:
        user.set_unusable_password()
        user.save()
    return user


def _generate_rei_reply(question, trigger_answer):
    logger.info(f'[Rei] 开始生成回答 (question_id={question.id})')
    logger.debug(f'[Rei] 问题标题: {question.title}')

    try:
        resp = requests.post(
            'http://localhost:5000/rei/reply',
            json={
                'question_title': question.title,
                'question_content': question.content,
                'trigger_content': trigger_answer.content,
            },
            timeout=120,
        )
        resp.raise_for_status()
        reply_text = resp.json()['reply']
        logger.info(f'[Rei] Flask 返回回答，长度: {len(reply_text)} 字符')
    except requests.exceptions.RequestException as e:
        logger.error(f'[Rei] Flask 请求失败: {e}')
        reply_text = 'Rei 出故障啦，请反馈给zyx_2012@outlook.com'
    except Exception as e:
        logger.error(f'[Rei] 处理失败: {e}', exc_info=True)
        reply_text = 'Rei 出故障啦，请反馈给zyx_2012@outlook.com'

    rei_user = _get_rei_user()
    Answer.objects.create(
        question=question,
        content=reply_text,
        author=rei_user,
        parent=trigger_answer,
    )
    logger.info(f'[Rei] 回答已保存 (answer_id={trigger_answer.id})')


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
def answer_list(request, pk):
    question = get_object_or_404(Question, pk=pk)

    if request.method == 'DELETE':
        answer_id = request.data.get('answer_id') or request.query_params.get('answer_id')
        if not answer_id:
            return Response({'error': 'answer_id required'}, status=400)
        if not request.user.is_staff:
            return Response({'error': '仅管理员可删除'}, status=403)
        answer = get_object_or_404(Answer, pk=answer_id, question=question)
        answer.delete()
        return Response({'ok': True}, status=200)

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
            answer = serializer.save(
                question=question,
                author=request.user if request.user.is_authenticated else None,
                parent=parent if parent_id else None,
            )
            if re.search(r'@Rei\b', request.data.get('content', ''), re.IGNORECASE):
                logger.info(f'[Rei] 检测到 @Rei 提及，启动后台线程')
                thread = threading.Thread(
                    target=_generate_rei_reply,
                    args=(question, answer),
                    daemon=True,
                )
                thread.start()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
