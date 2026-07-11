from datetime import timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from qa.models import Question, Answer
from knowledge.models import Article, Comment
from postbar.models import Subbar, Post, PostComment
from .serializers import UserSerializer


def is_admin(user):
    return user.is_staff or user.is_superuser


# ---- analytics helpers -------------------------------------------------

def _daily_dict(qs, field, days):
    """按天聚合某个 queryset 的新增数量，返回 {date_iso: count}。"""
    start = (timezone.now() - timedelta(days=days - 1)).date()
    rows = (
        qs.filter(**{f'{field}__date__gte': start})
        .annotate(_d=TruncDate(field))
        .values('_d')
        .annotate(_c=Count('id'))
    )
    return {r['_d'].isoformat(): r['_c'] for r in rows if r['_d']}


def _fill_series(dicts, days):
    """把一个或多个 {date: count} 字典按连续日期展开、逐日求和成时间序列。"""
    start = (timezone.now() - timedelta(days=days - 1)).date()
    out = []
    for i in range(days):
        day = (start + timedelta(days=i)).isoformat()
        out.append({'date': day, 'count': sum(d.get(day, 0) for d in dicts)})
    return out


# ---- dashboard ---------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    if not is_admin(request.user):
        return Response({'error': '权限不足'}, status=status.HTTP_403_FORBIDDEN)

    days = int(request.query_params.get('days', 14))
    days = max(2, min(days, 90))
    now = timezone.now()
    today = now.date()
    week_ago = now - timedelta(days=7)

    totals = {
        'users': User.objects.count(),
        'questions': Question.objects.count(),
        'answers': Answer.objects.count(),
        'articles': Article.objects.count(),
        'comments': Comment.objects.count(),
        'subbars': Subbar.objects.count(),
        'posts': Post.objects.count(),
        'post_comments': PostComment.objects.count(),
    }

    # 内容按类型分布（供占比条使用）
    content_breakdown = [
        {'key': 'questions', 'label': '问题', 'count': totals['questions']},
        {'key': 'answers', 'label': '回答', 'count': totals['answers']},
        {'key': 'articles', 'label': '文章', 'count': totals['articles']},
        {'key': 'posts', 'label': '帖子', 'count': totals['posts']},
        {'key': 'comments', 'label': '文章评论', 'count': totals['comments']},
        {'key': 'post_comments', 'label': '帖子回复', 'count': totals['post_comments']},
    ]

    # 时间序列：新增用户 / 新增内容（各类内容求和）
    users_series = _fill_series([_daily_dict(User.objects, 'date_joined', days)], days)
    content_dicts = [
        _daily_dict(Question.objects, 'created_at', days),
        _daily_dict(Answer.objects, 'created_at', days),
        _daily_dict(Article.objects, 'created_at', days),
        _daily_dict(Post.objects, 'created_at', days),
        _daily_dict(PostComment.objects, 'created_at', days),
        _daily_dict(Comment.objects, 'created_at', days),
    ]
    content_series = _fill_series(content_dicts, days)

    top_questions = [
        {'id': q.id, 'title': q.title, 'views': q.views, 'author': q.author.username if q.author else '—'}
        for q in Question.objects.order_by('-views')[:5]
    ]
    top_articles = [
        {'id': a.id, 'title': a.title, 'views': a.views, 'author': a.author.username if a.author else '—'}
        for a in Article.objects.order_by('-views')[:5]
    ]
    top_posts = [
        {'id': p.id, 'title': p.title, 'views': p.views, 'subbar': p.subbar.name}
        for p in Post.objects.select_related('subbar').order_by('-views')[:5]
    ]

    return Response({
        'totals': totals,
        'active_users_today': User.objects.filter(last_login__date=today).count(),
        'new_users_week': User.objects.filter(date_joined__gte=week_ago).count(),
        'new_posts_week': Post.objects.filter(created_at__gte=week_ago).count(),
        'days': days,
        'series': {'users': users_series, 'content': content_series},
        'content_breakdown': content_breakdown,
        'top_questions': top_questions,
        'top_articles': top_articles,
        'top_posts': top_posts,
        # 兼容旧前端字段
        'total_users': totals['users'],
        'total_questions': totals['questions'],
        'total_answers': totals['answers'],
        'total_articles': totals['articles'],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_users(request):
    if not is_admin(request.user):
        return Response({'error': '权限不足'}, status=status.HTTP_403_FORBIDDEN)

    users = User.objects.all().order_by('-date_joined')
    serializer = UserSerializer(users, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_user_detail(request, user_id):
    if not is_admin(request.user):
        return Response({'error': '权限不足'}, status=status.HTTP_403_FORBIDDEN)

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data)

    elif request.method == 'PATCH':
        data = request.data
        if 'is_staff' in data:
            user.is_staff = data['is_staff']
        if 'is_active' in data:
            user.is_active = data['is_active']
        if 'username' in data:
            user.username = data['username']
        if 'email' in data:
            user.email = data['email']
        user.save()
        return Response(UserSerializer(user, context={'request': request}).data)

    elif request.method == 'DELETE':
        user.delete()
        return Response({'message': '用户已删除'}, status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_content(request):
    if not is_admin(request.user):
        return Response({'error': '权限不足'}, status=status.HTTP_403_FORBIDDEN)

    content_type = request.query_params.get('type', 'all')

    data = {}
    if content_type in ['all', 'questions']:
        data['questions'] = [{
            'id': q.id,
            'title': q.title,
            'author': q.author.username if q.author else '—',
            'created_at': q.created_at,
            'views': q.views,
        } for q in Question.objects.select_related('author').order_by('-created_at')[:50]]

    if content_type in ['all', 'answers']:
        data['answers'] = [{
            'id': a.id,
            'question': a.question.title,
            'author': a.author.username if a.author else '—',
            'created_at': a.created_at,
        } for a in Answer.objects.select_related('question', 'author').order_by('-created_at')[:50]]

    if content_type in ['all', 'articles']:
        data['articles'] = [{
            'id': a.id,
            'title': a.title,
            'author': a.author.username if a.author else '—',
            'created_at': a.created_at,
        } for a in Article.objects.select_related('author').order_by('-created_at')[:50]]

    if content_type in ['all', 'posts']:
        data['posts'] = [{
            'id': p.id,
            'title': p.title,
            'subbar': p.subbar.name,
            'author': p.author.username if p.author else '—',
            'created_at': p.created_at,
            'views': p.views,
        } for p in Post.objects.select_related('subbar', 'author').order_by('-created_at')[:50]]

    return Response(data)


# 可删除的内容类型 -> 模型
MODERATION_MODELS = {
    'questions': Question,
    'answers': Answer,
    'articles': Article,
    'comments': Comment,
    'posts': Post,
    'postcomments': PostComment,
    'subbars': Subbar,
}


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_content_delete(request, kind, obj_id):
    """管理员删除任意一条内容（问题/回答/文章/帖子/评论/子吧）。"""
    if not is_admin(request.user):
        return Response({'error': '权限不足'}, status=status.HTTP_403_FORBIDDEN)

    model = MODERATION_MODELS.get(kind)
    if model is None:
        return Response({'error': f'未知内容类型: {kind}'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        obj = model.objects.get(id=obj_id)
    except model.DoesNotExist:
        return Response({'error': '内容不存在'}, status=status.HTTP_404_NOT_FOUND)

    obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
