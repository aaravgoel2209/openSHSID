from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db import models as django_models
from django.db.models import Q
from .models import Article, Grade, Subject, Comment
from .serializers import (
    GradeSerializer, SubjectSerializer,
    ArticleListSerializer, ArticleDetailSerializer, CommentSerializer,
)


@api_view(['GET'])
def grade_list(request):
    grades = Grade.objects.all()
    serializer = GradeSerializer(grades, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def subject_list(request):
    subjects = Subject.objects.all()
    serializer = SubjectSerializer(subjects, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def title_suggest(request):
    """顶部搜索栏实时建议：只按标题 icontains 匹配，返回轻量 {id, title, type, meta}。
    不查内容（快）、不带 embedding/labels（省流量），与列表搜索端点区分。"""
    query = (request.query_params.get('q') or '').strip()
    if not query:
        return Response([])
    try:
        limit = min(int(request.query_params.get('limit', 5)), 10)
    except (TypeError, ValueError):
        limit = 5

    from qa.models import Question
    articles = (
        Article.objects.filter(title__icontains=query)
        .select_related('grade', 'subject')
        .values('id', 'title', 'grade__name', 'subject__name')[:limit]
    )
    questions = Question.objects.filter(title__icontains=query).values('id', 'title')[:limit]

    hits = [
        {
            'id': a['id'],
            'title': a['title'],
            'type': 'article',
            'meta': ' · '.join(x for x in (a['grade__name'], a['subject__name']) if x),
        }
        for a in articles
    ]
    hits += [
        {'id': q_['id'], 'title': q_['title'], 'type': 'question', 'meta': ''}
        for q_ in questions
    ]
    return Response(hits)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def article_list(request):
    if request.method == 'GET':
        articles = Article.objects.all()
        grade = request.query_params.get('grade')
        subject = request.query_params.get('subject')
        search = request.query_params.get('search')
        label_id = request.query_params.get('label')
        if grade:
            articles = articles.filter(grade_id=grade)
        if subject:
            articles = articles.filter(subject_id=subject)
        if label_id:
            articles = articles.filter(labels__id=label_id)
        if search:
            articles = articles.filter(Q(title__icontains=search) | Q(content__icontains=search))
        serializer = ArticleListSerializer(articles, many=True)
        data = serializer.data

        # 内联排序（无 HTTP 开销）
        if request.user and request.user.is_authenticated and not grade and not subject:
            try:
                from .ranking import rank_articles
                user_emb = getattr(getattr(request.user, 'profile', None), 'embedding', None)
                if user_emb:
                    data = rank_articles(data, user_emb, user_id=request.user.id,
                                         show_score=request.user.is_staff)
            except Exception:
                pass

        return Response(data)

    if request.method == 'POST':
        from OpenSHSID_backend.moderation import blocked_words_error
        err = blocked_words_error(request.data.get('title', ''), request.data.get('content', ''))
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ArticleDetailSerializer(data=request.data)
        if serializer.is_valid():
            label_ids = request.data.get('labels', [])
            a = serializer.save(author=request.user if request.user.is_authenticated else None)
            if label_ids:
                from qa.models import Label
                a.labels.set(Label.objects.filter(id__in=label_ids))
            # 后台自动检测语言并翻译成另一种语言，缓存供前端按语言切换
            from OpenSHSID_backend.translation import translate_instance_async
            translate_instance_async(a)
            return Response(ArticleDetailSerializer(a, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
def article_detail(request, pk):
    article = get_object_or_404(Article, pk=pk)
    if request.method == 'DELETE':
        if not request.user.is_staff:
            return Response({'error': '仅管理员可删除'}, status=403)
        article.delete()
        return Response({'ok': True}, status=200)
    serializer = ArticleDetailSerializer(article, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
def view_article(request, pk):
    Article.objects.filter(pk=pk).update(views=django_models.F('views') + 1)
    return Response({'ok': True})


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
def comment_list(request, pk):
    """文章评论：GET 列表（嵌套回复）/ POST 发表（可带 parent 回复某条）/ DELETE 管理员删除"""
    article = get_object_or_404(Article, pk=pk)

    if request.method == 'DELETE':
        comment_id = request.data.get('comment_id') or request.query_params.get('comment_id')
        if not comment_id:
            return Response({'error': 'comment_id required'}, status=400)
        if not request.user.is_staff:
            return Response({'error': '仅管理员可删除'}, status=403)
        comment = get_object_or_404(Comment, pk=comment_id, article=article)
        comment.delete()
        return Response({'ok': True}, status=200)

    if request.method == 'GET':
        comments = article.comments.filter(parent=None)
        serializer = CommentSerializer(comments, many=True, context={'request': request})
        return Response(serializer.data)

    if request.method == 'POST':
        from OpenSHSID_backend.moderation import blocked_words_error
        err = blocked_words_error('', request.data.get('content', ''))
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
        serializer = CommentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            parent_id = request.data.get('parent')
            parent = None
            if parent_id:
                parent = get_object_or_404(Comment, pk=parent_id, article=article)
            serializer.save(
                article=article,
                author=request.user if request.user.is_authenticated else None,
                parent=parent,
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def like_comment(request, pk):
    comment = get_object_or_404(Comment, pk=pk)
    if comment.likes.filter(id=request.user.id).exists():
        comment.likes.remove(request.user)
    else:
        comment.likes.add(request.user)
    return Response({'liked': comment.likes.filter(id=request.user.id).exists(), 'count': comment.likes.count()})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def like_article(request, pk):
    article = get_object_or_404(Article, pk=pk)
    if article.likes.filter(id=request.user.id).exists():
        article.likes.remove(request.user)
    else:
        article.likes.add(request.user)
    return Response({'liked': article.likes.filter(id=request.user.id).exists(), 'count': article.likes.count()})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def ocr_import(request):
    """【占位 / Placeholder】文档 OCR → 知识库。

    当前实现：上传一份 PDF/图片 → 调本地模型服务 OCR → 返回 Markdown 文本；
    可选 save=true 时把文本直接落库成一篇文章（标题取文件名）。

    尚未接入（后续任务）：
      1. LinkedClassroom PDF 自动拉取（走 crawler 的 download 代理），免手动上传；
      2. Rei 大模型对 OCR 文本做摘要/清洗，再作为文章正文。
    这两步落地前，本端点仅做「识别 + 原样落库」，作为流程预留桩。
    """
    from .ocr_client import ocr_document, service_available

    upload = request.FILES.get('file')
    if upload is None:
        return Response({'error': '请通过 multipart 的 file 字段上传 PDF/图片'},
                        status=status.HTTP_400_BAD_REQUEST)

    if not service_available():
        return Response(
            {'error': '模型服务离线（localhost:5000），OCR 暂不可用', 'service': 'offline'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    text = ocr_document(upload.read(), upload.name)
    if text is None:
        return Response(
            {'error': 'OCR 未就绪或识别失败（模型后端需 GPU + 权重）', 'service': 'unavailable'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    result = {'filename': upload.name, 'text': text, 'chars': len(text)}

    # 占位：summary 步骤待接入 AI，先留空
    if str(request.data.get('save', '')).lower() in ('1', 'true', 'yes') and text.strip():
        title = upload.name.rsplit('.', 1)[0][:200] or 'OCR 导入'
        article = Article.objects.create(
            title=title,
            content=text,
            author=request.user if request.user.is_authenticated else None,
            author_name=getattr(request.user, 'username', ''),
        )
        result['article_id'] = article.id
        result['saved'] = True

    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ocr_scan(request):
    """工具箱·OCR 扫描：上传 PDF/图片 → OCR → 返回带版面框的可勾选区域。

    返回：{filename, pages:[{index,image}], regions:[{id,page,type,bbox,text}], text}
    bbox 为 0-999 归一化坐标，前端据此在页面预览图上画框 + 勾选。
    OCR 服务离线/未就绪时返回 503（前端据此提示）。
    """
    from .ocr_client import ocr_document_structured, service_available

    upload = request.FILES.get('file')
    if upload is None:
        return Response({'error': '请通过 multipart 的 file 字段上传 PDF/图片'},
                        status=status.HTTP_400_BAD_REQUEST)

    if not service_available():
        return Response({'error': 'OCR 服务离线，暂不可用', 'service': 'offline'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)

    data = ocr_document_structured(upload.read(), upload.name)
    if data is None:
        return Response({'error': 'OCR 未就绪或识别失败（模型后端需 GPU + 权重）', 'service': 'unavailable'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response({
        'filename': upload.name,
        'pages': data['pages'],
        'regions': data['regions'],
        'text': data['text'],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ocr_scan_stream(request):
    """工具箱·OCR 扫描（流式）：逐页把结构化结果以 NDJSON 下发，避免大 PDF 一次性阻塞超时。

    响应体：application/x-ndjson，每行一个事件：
      {"event":"meta","pages":N}
      {"event":"page","index":i,"image":"data:...","regions":[...]}   ← 每识别完一页即下发
      {"event":"done","text":"<全文>"}
      {"event":"error","error":"...","code":503?}                      ← 出错时（连接已建立）
    OCR 服务离线时仍走普通 JSON 503（连接尚未升级为流）。
    """
    from django.http import StreamingHttpResponse
    from .ocr_client import ocr_document_structured_stream, service_available

    upload = request.FILES.get('file')
    if upload is None:
        return Response({'error': '请通过 multipart 的 file 字段上传 PDF/图片'},
                        status=status.HTTP_400_BAD_REQUEST)

    if not service_available():
        return Response({'error': 'OCR 服务离线，暂不可用', 'service': 'offline'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)

    stream = ocr_document_structured_stream(upload.read(), upload.name)
    resp = StreamingHttpResponse(stream, content_type='application/x-ndjson')
    resp['Cache-Control'] = 'no-cache'
    resp['X-Accel-Buffering'] = 'no'  # 关掉 nginx 缓冲，保证逐页实时下发
    return resp


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ocr_save(request):
    """工具箱·OCR 扫描：把勾选文本存入知识库，返回新建文章 id。

    请求体：{"title": "可选标题", "text": "正文"}
    """
    text = (request.data.get('text') or '').strip()
    title = (request.data.get('title') or '').strip() or 'OCR 导入'
    if not text:
        return Response({'error': '没有可保存的文本'}, status=status.HTTP_400_BAD_REQUEST)

    from OpenSHSID_backend.moderation import blocked_words_error
    err = blocked_words_error(title, text)
    if err:
        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

    article = Article.objects.create(
        title=title[:200],
        content=text,
        author=request.user if request.user.is_authenticated else None,
        author_name=getattr(request.user, 'username', ''),
    )
    from OpenSHSID_backend.translation import translate_instance_async
    translate_instance_async(article)
    return Response({'article_id': article.id, 'title': article.title}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ocr_summarize(request):
    """工具箱·OCR 扫描：把用户勾选的文本交给主聊天模型摘要并返回。

    请求体：{"text": "...", "instruction": "可选"}
    返回：{summary}。主聊天模型不可用时返回 503。
    """
    from .ocr_client import summarize

    text = (request.data.get('text') or '').strip()
    instruction = (request.data.get('instruction') or '').strip()
    if not text:
        return Response({'error': '没有可摘要的文本'}, status=status.HTTP_400_BAD_REQUEST)

    result = summarize(text, instruction)
    if result is None:
        return Response({'error': '主聊天模型不可用，摘要失败', 'service': 'unavailable'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response({'summary': result})
