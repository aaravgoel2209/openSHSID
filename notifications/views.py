from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Notification
from .serializers import NotificationSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_list(request):
    """当前用户的信箱（最近 100 条）"""
    qs = Notification.objects.filter(recipient=request.user)[:100]
    return Response(NotificationSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count(request):
    n = Notification.objects.filter(recipient=request.user, is_read=False).count()
    return Response({'count': n})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_read(request, pk):
    notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
    if not notif.is_read:
        notif.is_read = True
        notif.save(update_fields=['is_read'])
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({'ok': True})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def clear_all(request):
    Notification.objects.filter(recipient=request.user).delete()
    return Response({'ok': True})
