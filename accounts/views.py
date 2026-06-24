from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from django.contrib.auth.models import User
from django.utils import timezone
from .models import UserProfile, Notice
from .serializers import RegisterSerializer, UserSerializer
from qa.models import Question, Answer
from knowledge.models import Article


class LoginView(ObtainAuthToken):
    # DRF 3.17+ removed authentication_classes=() from ObtainAuthToken, so
    # SessionAuthentication is now inherited from defaults. When a Django admin
    # session cookie exists, it calls enforce_csrf() and rejects the login POST.
    # Login/register don't need any pre-existing auth — clear it explicitly.
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
        })


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_avatar(request):
    file = request.FILES.get('avatar')
    if not file:
        return Response({'error': '未提供文件'}, status=status.HTTP_400_BAD_REQUEST)
    if file.content_type not in ('image/jpeg', 'image/png', 'image/gif', 'image/webp'):
        return Response({'error': '仅支持 JPG、PNG、GIF、WebP 格式'}, status=status.HTTP_400_BAD_REQUEST)
    if file.size > 5 * 1024 * 1024:
        return Response({'error': '文件大小不能超过 5MB'}, status=status.HTTP_400_BAD_REQUEST)
    profile_obj, _ = UserProfile.objects.get_or_create(user=request.user)
    if profile_obj.avatar:
        profile_obj.avatar.delete(save=False)
    profile_obj.avatar = file
    profile_obj.save(update_fields=['avatar'])
    return Response(UserSerializer(request.user, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile(request):
    return Response(UserSerializer(request.user, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_profile(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': '用户不存在'}, status=404)
    return Response(UserSerializer(user, context={'request': request}).data)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def notices(request):
    if request.method == 'GET':
        items = Notice.objects.select_related('created_by').all()
        return Response([{
            'id': n.id,
            'title': n.title,
            'content': n.content,
            'created_by': n.created_by.username,
            'created_at': n.created_at.strftime('%Y-%m-%d'),
        } for n in items])
    if not request.user.is_authenticated or not request.user.is_staff:
        return Response({'error': '无权限'}, status=status.HTTP_403_FORBIDDEN)
    title = (request.data.get('title') or '').strip()
    content = (request.data.get('content') or '').strip()
    if not title:
        return Response({'error': '标题不能为空'}, status=status.HTTP_400_BAD_REQUEST)
    n = Notice.objects.create(title=title, content=content, created_by=request.user)
    return Response({'id': n.id, 'title': n.title, 'content': n.content,
                     'created_by': request.user.username, 'created_at': n.created_at.strftime('%Y-%m-%d')},
                    status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def notice_detail(request, notice_id):
    if not request.user.is_staff:
        return Response({'error': '无权限'}, status=status.HTTP_403_FORBIDDEN)
    try:
        Notice.objects.get(id=notice_id).delete()
    except Notice.DoesNotExist:
        return Response({'error': '不存在'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([AllowAny])
def weekly_top_users(request):
    since = timezone.now() - timezone.timedelta(days=7)
    qs = list(Question.objects.filter(created_at__gte=since, author__isnull=False).prefetch_related('likes'))
    ans = list(Answer.objects.filter(created_at__gte=since, author__isnull=False).prefetch_related('likes'))
    arts = list(Article.objects.filter(created_at__gte=since, author__isnull=False).prefetch_related('likes'))
    heat_sums = {}
    for q in qs:
        aid = q.author_id
        days = (timezone.now() - q.created_at).days
        h = 2.0 + q.views * 0.1 + q.likes.count() * 0.3 + q.answers.count() * 0.2 - days * 0.1
        heat_sums[aid] = heat_sums.get(aid, 0) + max(0, h)
    for a in ans:
        aid = a.author_id
        h = 1.0 + a.likes.count() * 0.2
        heat_sums[aid] = heat_sums.get(aid, 0) + max(0, h)
    for a in arts:
        aid = a.author_id
        days = (timezone.now() - a.created_at).days
        h = 2.0 + a.views * 0.1 + a.likes.count() * 0.3 - days * 0.1
        heat_sums[aid] = heat_sums.get(aid, 0) + max(0, h)
    sorted_users = sorted(heat_sums.items(), key=lambda x: x[1], reverse=True)[:5]
    users_map = {u.id: u for u in User.objects.filter(id__in=[u[0] for u in sorted_users])}
    return Response([{
        'id': uid,
        'username': users_map[uid].username,
        'question_count': sum(1 for q in qs if q.author_id == uid),
        'answer_count': sum(1 for a in ans if a.author_id == uid),
        'article_count': sum(1 for a in arts if a.author_id == uid),
        'total_heat': round(heat, 2),
    } for uid, heat in sorted_users if uid in users_map])
