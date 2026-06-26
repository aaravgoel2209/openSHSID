from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from django.contrib.auth.models import User
from .models import Message
from .serializers import MessageSerializer, ConversationSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conversation_list(request):
    """List all users the current user has exchanged messages with, with last message preview."""
    sent = Message.objects.filter(sender=request.user).values('recipient')
    received = Message.objects.filter(recipient=request.user).values('sender')
    user_ids = set(m['recipient'] for m in sent) | set(m['sender'] for m in received)

    conversations = []
    for uid in user_ids:
        last_msg = Message.objects.filter(
            Q(sender=request.user, recipient_id=uid) |
            Q(sender_id=uid, recipient=request.user)
        ).select_related('sender__profile', 'recipient__profile').first()
        if last_msg:
            other = last_msg.sender if last_msg.sender != request.user else last_msg.recipient
            profile = getattr(other, 'profile', None)
            avatar = request.build_absolute_uri(profile.avatar.url) if (profile and profile.avatar) else None
            conversations.append({
                'user_id': other.id,
                'username': other.username,
                'avatar': avatar,
                'last_message': last_msg.content[:80],
                'last_message_at': last_msg.created_at,
                'unread': False,
            })

    conversations.sort(key=lambda c: c['last_message_at'], reverse=True)
    return Response(ConversationSerializer(conversations, many=True).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def message_list(request):
    """Get messages with a specific user, or send a new message."""
    if request.method == 'GET':
        other_id = request.query_params.get('user')
        if not other_id:
            return Response({'error': 'user parameter required'}, status=400)
        messages = Message.objects.filter(
            Q(sender=request.user, recipient_id=other_id) |
            Q(sender_id=other_id, recipient=request.user)
        ).order_by('created_at').select_related('sender__profile', 'recipient__profile')
        return Response(MessageSerializer(messages, many=True, context={'request': request}).data)

    if request.method == 'POST':
        serializer = MessageSerializer(data=request.data)
        if serializer.is_valid():
            try:
                recipient = User.objects.get(id=request.data['recipient'])
            except User.DoesNotExist:
                return Response({'error': '用户不存在'}, status=404)
            serializer.save(sender=request.user, recipient=recipient)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_search(request):
    """Search users by username for the recipient selector."""
    q = request.query_params.get('q', '').strip()
    if not q:
        return Response([])
    users = User.objects.filter(username__icontains=q).exclude(id=request.user.id).select_related('profile')[:10]

    def _avatar(u):
        profile = getattr(u, 'profile', None)
        return request.build_absolute_uri(profile.avatar.url) if (profile and profile.avatar) else None

    return Response([{'id': u.id, 'username': u.username, 'avatar': _avatar(u)} for u in users])
