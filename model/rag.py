"""
RAG 检索 — 基于语义向量的记忆库检索

- embedding 来自 OpenAI 兼容的 /v1/embeddings 接口（llama.cpp）
- 语料 = 本地读写记忆库（database.py 的 items 表）
- 每条记忆存一份向量，查询时按余弦相似度取 top-K 注入 prompt
"""
import os
import time
import json
import hashlib
import logging
import urllib.request
import numpy as np

logger = logging.getLogger(__name__)

_cache = {}

# 检索参数（可用环境变量覆盖）
TOP_K = int(os.environ.get('REI_RAG_TOP_K', '4'))
MIN_SCORE = float(os.environ.get('REI_RAG_MIN_SCORE', '0.25'))
# embedding 服务超时（秒）；服务慢/不可用时快速失败，避免拖住每次回答
EMBED_TIMEOUT = float(os.environ.get('REI_EMBED_TIMEOUT', '8'))

# Django 内容来源同步配置
DJANGO_API = os.environ.get('REI_DJANGO_API', 'http://localhost:19424/api')
SYNC_TTL = float(os.environ.get('REI_SYNC_TTL', '300'))  # 同步节流（秒）
_last_sync = {}  # source -> 上次同步时间戳

# 各来源的列表/详情接口；detail 不为 None 表示列表不含正文，需逐条取详情
SOURCE_FEEDS = {
    'kb': {'list': f'{DJANGO_API}/knowledge/articles/', 'detail': f'{DJANGO_API}/knowledge/articles/{{id}}/'},
    'qa': {'list': f'{DJANGO_API}/qa/questions/',       'detail': None},
}

SOURCE_LABEL = {'memory': '记忆', 'kb': '知识库', 'qa': '问答'}


def _get_embed_client():
    """embedding 客户端，独立于聊天模型（llama.cpp 的 embedding server 通常另起端口）"""
    if 'client' not in _cache:
        from openai import OpenAI
        # 独立的 embedding 服务（聊天模型无法做 embedding）；默认 8034 端口
        base = os.environ.get('REI_EMBED_API_BASE', 'http://192.168.2.103:8034/v1')
        key = os.environ.get('REI_EMBED_API_KEY') or os.environ.get('REI_API_KEY', '114514')
        model = os.environ.get('REI_EMBED_MODEL', 'embedding')
        logger.info(f'[RAG] embedding 接口: {base} model={model} timeout={EMBED_TIMEOUT}s')
        # embedding 服务是直连主机：忽略系统代理（trust_env=False），否则 LAN 请求会被
        # HTTP_PROXY 劫持导致超时；同时短超时 + 不重试，异常时快速回退而非阻塞回答
        import httpx
        http_client = httpx.Client(trust_env=False, timeout=EMBED_TIMEOUT)
        _cache['client'] = OpenAI(base_url=base, api_key=key, max_retries=0, http_client=http_client)
        _cache['model'] = model
    return _cache['client'], _cache['model']


def embed_texts(texts):
    """批量生成向量，返回 list[np.ndarray]；失败抛异常由调用方处理"""
    if not texts:
        return []
    client, model = _get_embed_client()
    resp = client.embeddings.create(model=model, input=texts)
    return [np.asarray(d.embedding, dtype=np.float32) for d in resp.data]


def embed_query(text):
    return embed_texts([text])[0]


def _cosine(a, b):
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)


def compute_item_embedding(title, content):
    """为单条记忆生成向量（title + content 拼接）；失败返回 None"""
    text = f'{title}\n{content}'.strip()
    if not text:
        return None
    try:
        return embed_texts([text])[0].tolist()
    except Exception as e:
        logger.error(f'[RAG] 生成向量失败: {e}')
        return None


def _http_get_json(url):
    # 直连本地 Django，绕过系统代理（HTTP_PROXY 可能劫持导致超时）
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(url, timeout=8) as r:
        return json.loads(r.read())


def sync_source(source, force=False):
    """从 Django 增量同步某来源（kb / qa）到本地向量缓存（按内容 hash 判断是否需重算）。
    受 SYNC_TTL 节流；列表不含正文的来源（如 kb）会逐条取详情。"""
    feed = SOURCE_FEEDS.get(source)
    if not feed:
        return
    if not force and (time.time() - _last_sync.get(source, 0)) < SYNC_TTL:
        return
    from database import get_chunk_hashes, upsert_chunk, delete_chunks_not_in
    try:
        items = _http_get_json(feed['list'])
    except Exception as e:
        logger.error(f'[RAG] {source} 列表获取失败: {e}')
        return
    _last_sync[source] = time.time()

    existing = get_chunk_hashes(source)
    seen, changed = [], 0
    for it in items:
        eid = it.get('id')
        if eid is None:
            continue
        seen.append(eid)
        title = it.get('title', '') or ''
        content = it.get('content')
        # 列表不含正文时取详情
        if content is None and feed['detail']:
            try:
                detail = _http_get_json(feed['detail'].format(id=eid))
            except Exception as e:
                logger.error(f'[RAG] {source} 条目 {eid} 详情获取失败: {e}')
                continue
            title = detail.get('title', title) or ''
            content = detail.get('content', '') or ''
        content = content or ''
        h = hashlib.md5(f'{title}\n{content}'.encode('utf-8')).hexdigest()
        if existing.get(eid) == h:
            continue  # 未变化，跳过
        emb = compute_item_embedding(title, content)
        if emb:
            upsert_chunk(source, eid, title, content, emb, h)
            changed += 1
    delete_chunks_not_in(source, seen)
    logger.info(f'[RAG] {source} 同步完成: {len(seen)} 条，{changed} 条更新向量')


def sync_all(force=False):
    """同步所有 Django 来源（知识库 + 问答）"""
    for source in SOURCE_FEEDS:
        sync_source(source, force=force)


def _load_corpus(sources):
    """汇总检索语料；每条带 source 标记"""
    from database import load_items_with_embeddings, load_chunks
    corpus = []
    if 'memory' in sources:
        for it in load_items_with_embeddings():
            if it.get('embedding'):
                corpus.append({**it, 'source': 'memory'})
    for source in SOURCE_FEEDS:
        if source in sources:
            sync_source(source)  # 受节流保护
            for c in load_chunks(source):
                if c.get('embedding'):
                    corpus.append({**c, 'source': source})
    return corpus


def retrieve(query, top_k=TOP_K, min_score=MIN_SCORE, sources=('memory', 'kb', 'qa')):
    """在记忆库 + 知识库 + 问答中按语义相似度检索，返回 [(item_dict, score), ...]（按分数降序）。
    item_dict 含 source('memory'|'kb'|'qa')、id、title、content。"""
    corpus = _load_corpus(sources)
    if not corpus:
        return []
    try:
        q = embed_query(query)
    except Exception as e:
        logger.error(f'[RAG] query embedding 失败: {e}')
        return []

    scored = []
    for it in corpus:
        emb = np.asarray(it['embedding'], dtype=np.float32)
        if emb.shape != q.shape:
            continue
        scored.append((it, _cosine(q, emb)))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [(it, s) for it, s in scored[:top_k] if s >= min_score]


def backfill_embeddings():
    """为缺失向量的记忆补齐 embedding，返回补齐数量"""
    from database import load_items_with_embeddings, save_item_embedding
    missing = [it for it in load_items_with_embeddings() if not it.get('embedding')]
    if not missing:
        return 0
    n = 0
    for it in missing:
        emb = compute_item_embedding(it['title'], it['content'])
        if emb:
            save_item_embedding(it['id'], emb)
            n += 1
    logger.info(f'[RAG] 已补齐 {n}/{len(missing)} 条记忆向量')
    return n


def format_context(hits):
    """把检索结果格式化为可注入 prompt 的文本"""
    if not hits:
        return ''
    lines = ['以下是从知识库和记忆库检索到的相关信息，可作为回答参考（如不相关请忽略）：']
    for it, score in hits:
        src = SOURCE_LABEL.get(it.get('source', ''), '')
        lines.append(f'- [{src} ID={it["id"]} 相关度={score:.2f}] {it["title"]}：{it["content"]}')
    return '\n'.join(lines)
