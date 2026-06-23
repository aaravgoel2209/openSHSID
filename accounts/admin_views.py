from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.utils import timezone
from qa.models import Question, Answer
from knowledge.models import Article
from .serializers import UserSerializer


def is_admin(user):
    return user.is_staff or user.is_superuser


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    if not is_admin(request.user):
        return Response({'error': '权限不足'}, status=status.HTTP_403_FORBIDDEN)

    stats = {
        'total_users': User.objects.count(),
        'total_questions': Question.objects.count(),
        'total_answers': Answer.objects.count(),
        'total_articles': Article.objects.count(),
        'active_users_today': User.objects.filter(last_login__date=timezone.now().date()).count(),
    }
    return Response(stats)


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
        questions = Question.objects.all().order_by('-created_at')[:50]
        data['questions'] = [{
            'id': q.id,
            'title': q.title,
            'author': q.author.username,
            'created_at': q.created_at,
            'views': q.views,
        } for q in questions]

    if content_type in ['all', 'answers']:
        answers = Answer.objects.all().order_by('-created_at')[:50]
        data['answers'] = [{
            'id': a.id,
            'question': a.question.title,
            'author': a.author.username,
            'created_at': a.created_at,
        } for a in answers]

    if content_type in ['all', 'articles']:
        articles = Article.objects.all().order_by('-created_at')[:50]
        data['articles'] = [{
            'id': a.id,
            'title': a.title,
            'author': a.author.username,
            'created_at': a.created_at,
        } for a in articles]

    return Response(data)
