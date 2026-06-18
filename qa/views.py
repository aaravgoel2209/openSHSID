import re
import json
import time
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


def _rank_questions(data, user_emb):
    """用算法对问题排序: avg(max(item * heat - user, 0)) * 10"""
    try:
        from knowledge.ranking import score_item_algorithm, PUSH_MODE, HEAT_INIT, HEAT_CLICK, HEAT_LIKE
        for a in data:
            heat = HEAT_INIT + (a.get('views', 0) or 0) * HEAT_CLICK + (a.get('like_count', 0) or 0) * HEAT_LIKE
            a['_heat'] = heat
        import torch
        scored = []
        for a in data:
            emb = a.get('embedding', [])
            if not emb or not user_emb:
                scored.append((0, a))
            elif len(emb) != 32:
                scored.append((0, a))
            else:
                s = score_item_algorithm(emb, user_emb, a['_heat'])
                scored.append((s, a))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [a for _, a in scored]
    except Exception:
        return data


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def question_list(request):
    if request.method == 'GET':
        questions = Question.objects.all()
        q = request.query_params.get('search')
        if q:
            questions = questions.filter(Q(title__icontains=q) | Q(content__icontains=q))
        serializer = QuestionListSerializer(questions, many=True)
        data = serializer.data

        # 内联排序（登录用户 + 无搜索时）
        if request.user and request.user.is_authenticated and not q:
            try:
                user_emb = getattr(getattr(request.user, 'profile', None), 'embedding', None)
                if user_emb:
                    data = _rank_questions(data, user_emb)
            except Exception:
                pass

        return Response(data)

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
    """后台流式生成 Rei 回答：先建一条空回答（is_streaming=True），
    再消费模型服务的 SSE，边到边写入 content，让前端轮询时看到逐字增长。"""
    logger.info(f'[Rei] 开始流式生成回答 (question_id={question.id})')

    rei_user = _get_rei_user()
    answer = Answer.objects.create(
        question=question,
        content='',
        author=rei_user,
        parent=trigger_answer,
        is_streaming=True,
    )
    logger.info(f'[Rei] 已创建占位回答 (answer_id={answer.id})')

    buf = []
    final_text = ''
    last_save = time.monotonic()
    SAVE_INTERVAL = 0.4  # DB 写入节流，避免每个 token 都落库

    try:
        with requests.post(
            'http://localhost:5000/rei/stream',
            json={
                'question_id': question.id,
                'session_id': f'qa-{question.id}',  # 按问答帖隔离对话上下文
                'question_title': question.title,
                'question_content': question.content,
                'trigger_content': trigger_answer.content,
            },
            stream=True,
            timeout=300,
            proxies={'http': None, 'https': None},  # 直连本地模型服务，绕过系统代理
        ) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines(decode_unicode=True):
                if not line or not line.startswith('data:'):
                    continue
                payload = line[5:].strip()
                if payload == '[DONE]':
                    break
                try:
                    ev = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                etype = ev.get('type')
                if etype == 'content':
                    buf.append(ev.get('text', ''))
                    now = time.monotonic()
                    if now - last_save >= SAVE_INTERVAL:
                        answer.content = ''.join(buf)
                        answer.save(update_fields=['content'])
                        last_save = now
                elif etype == 'done':
                    final_text = ev.get('text') or ''.join(buf)
                elif etype == 'error':
                    logger.error(f'[Rei] 模型流式错误: {ev.get("text")}')
                    final_text = ''.join(buf) or 'Rei 出故障啦，请反馈给zyx_2012@outlook.com'
        final_text = final_text or ''.join(buf) or '（模型未返回有效回答）'
    except requests.exceptions.RequestException as e:
        logger.error(f'[Rei] 模型服务请求失败: {e}')
        final_text = ''.join(buf) or 'Rei 出故障啦，请反馈给zyx_2012@outlook.com'
    except Exception as e:
        logger.error(f'[Rei] 处理失败: {e}', exc_info=True)
        final_text = ''.join(buf) or 'Rei 出故障啦，请反馈给zyx_2012@outlook.com'

    answer.content = final_text
    answer.is_streaming = False
    answer.save(update_fields=['content', 'is_streaming'])
    logger.info(f'[Rei] 回答完成 (answer_id={answer.id}, {len(final_text)} 字符)')


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
