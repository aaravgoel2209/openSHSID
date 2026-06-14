from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils import timezone
from .serializers import RegisterSerializer, UserSerializer
from qa.models import Question, Answer
from knowledge.models import Article


class LoginView(ObtainAuthToken):
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
