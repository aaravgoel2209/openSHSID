from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.db import models as django_models
from django.db.models import Q

from OpenSHSID_backend.moderation import blocked_words_error
from .models import Subbar, Post, PostComment
from .serializers import (
    SubbarSerializer, PostListSerializer, PostDetailSerializer, PostCommentSerializer,
)


def _is_owner(user, subbar):
    """仅吧主（或站点管理员）——任免吧务的权限。"""
    return bool(user and user.is_authenticated and (user.is_staff or subbar.created_by_id == user.id))


# ---------------------------------------------------------------- 子吧 Subbar

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def subbar_list(request):
    if request.method == 'GET':
        subbars = Subbar.objects.all()
        q = request.query_params.get('search')
        if q:
            subbars = subbars.filter(Q(name__icontains=q) | Q(description__icontains=q))
        return Response(SubbarSerializer(subbars, many=True, context={'request': request}).data)

    # POST — 创建子吧
    err = blocked_words_error(request.data.get('name', ''), request.data.get('description', ''))
    if err:
        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
    serializer = SubbarSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        subbar = serializer.save(created_by=request.user if request.user.is_authenticated else None)
        return Response(SubbarSerializer(subbar, context={'request': request}).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def subbar_detail(request, pk):
    subbar = get_object_or_404(Subbar, pk=pk)
    return Response(SubbarSerializer(subbar, context={'request': request}).data)


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
def subbar_managers(request, pk):
    """吧务团队：GET 返回子吧信息（含 managers）；POST 任命吧务、DELETE 撤销吧务（仅吧主）。"""
    subbar = get_object_or_404(Subbar, pk=pk)

    if request.method == 'GET':
        return Response(SubbarSerializer(subbar, context={'request': request}).data)

    if not _is_owner(request.user, subbar):
        return Response({'error': '仅吧主可管理吧务团队'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'POST':
        username = (request.data.get('username') or '').strip()
        user_id = request.data.get('user_id')
        target = None
        if user_id:
            target = User.objects.filter(id=user_id).first()
        elif username:
            target = User.objects.filter(username=username).first()
        if not target:
            return Response({'error': '找不到该用户'}, status=status.HTTP_404_NOT_FOUND)
        if target.id == subbar.created_by_id:
            return Response({'error': '该用户已是吧主'}, status=status.HTTP_400_BAD_REQUEST)
        subbar.managers.add(target)
        return Response(SubbarSerializer(subbar, context={'request': request}).data, status=status.HTTP_201_CREATED)

    # DELETE — 撤销吧务
    user_id = request.data.get('user_id') or request.query_params.get('user_id')
    if not user_id:
        return Response({'error': 'user_id required'}, status=status.HTTP_400_BAD_REQUEST)
    subbar.managers.remove(*User.objects.filter(id=user_id))
    return Response(SubbarSerializer(subbar, context={'request': request}).data)


# ---------------------------------------------------------------- 帖子 Post

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def subbar_posts(request, pk):
    """某个子吧下的帖子列表 / 在该子吧发帖。"""
    subbar = get_object_or_404(Subbar, pk=pk)

    if request.method == 'GET':
        posts = subbar.posts.all()
        return Response(PostListSerializer(posts, many=True, context={'request': request}).data)

    # POST — 发帖
    err = blocked_words_error(request.data.get('title', ''), request.data.get('content', ''))
    if err:
        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
    serializer = PostListSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        post = serializer.save(
            subbar=subbar,
            author=request.user if request.user.is_authenticated else None,
        )
        return Response(PostDetailSerializer(post, context={'request': request}).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
def post_detail(request, pk):
    post = get_object_or_404(Post, pk=pk)

    if request.method == 'DELETE':
        if not post.subbar.can_manage(request.user):
            return Response({'error': '仅吧务团队可删除帖子'}, status=status.HTTP_403_FORBIDDEN)
        post.delete()
        return Response({'ok': True}, status=status.HTTP_200_OK)

    return Response(PostDetailSerializer(post, context={'request': request}).data)


@api_view(['POST'])
def view_post(request, pk):
    Post.objects.filter(pk=pk).update(views=django_models.F('views') + 1)
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def like_post(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if post.likes.filter(id=request.user.id).exists():
        post.likes.remove(request.user)
    else:
        post.likes.add(request.user)
    return Response({'liked': post.likes.filter(id=request.user.id).exists(), 'count': post.likes.count()})


# ---------------------------------------------------------------- 回复 PostComment

@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
def post_comments(request, pk):
    post = get_object_or_404(Post, pk=pk)

    if request.method == 'DELETE':
        comment_id = request.data.get('comment_id') or request.query_params.get('comment_id')
        if not comment_id:
            return Response({'error': 'comment_id required'}, status=400)
        if not post.subbar.can_manage(request.user):
            return Response({'error': '仅吧务团队可删除回复'}, status=403)
        comment = get_object_or_404(PostComment, pk=comment_id, post=post)
        comment.delete()
        return Response({'ok': True}, status=200)

    if request.method == 'GET':
        comments = post.comments.filter(parent=None)
        return Response(PostCommentSerializer(comments, many=True, context={'request': request}).data)

    # POST — 发表回复
    err = blocked_words_error(request.data.get('content', ''))
    if err:
        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
    serializer = PostCommentSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        parent_id = request.data.get('parent')
        parent = get_object_or_404(PostComment, pk=parent_id, post=post) if parent_id else None
        serializer.save(
            post=post,
            author=request.user if request.user.is_authenticated else None,
            parent=parent,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def like_comment(request, pk):
    comment = get_object_or_404(PostComment, pk=pk)
    if comment.likes.filter(id=request.user.id).exists():
        comment.likes.remove(request.user)
    else:
        comment.likes.add(request.user)
    return Response({'liked': comment.likes.filter(id=request.user.id).exists(), 'count': comment.likes.count()})
