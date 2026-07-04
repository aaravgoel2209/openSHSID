"""
RAG 检索 — 基于语义向量的记忆库检索

- embedding 来自 OpenAI 兼容的 /v1/embeddings 接口（llama.cpp）
- 语料 = 本地读写记忆库（database.py 的 items 表）+ Django 同步内容（知识库/问答）
- 长文按段切块（每块单独一条向量），查询时按余弦相似度取 top-K 注入 prompt

性能要点：
- 查询向量 LRU 缓存（重复/相近提问不重复调 embedding 服务）
- 语料矩阵缓存：把全部向量堆成一个归一化矩阵，检索时单次矩阵乘法，
  而非逐条 python 循环算余弦
- Django 内容同步在语料非空时移入后台线程，不阻塞回答
"""
import os
import re
import time
import json
import hashlib
import logging
import threading
import urllib.request
from collections import OrderedDict
import numpy as np

logger = logging.getLogger(__name__)

_cache = {}

# 检索参数（可用环境变量覆盖）
TOP_K = int(os.environ.get('REI_RAG_TOP_K', '4'))
MIN_SCORE = float(os.environ.get('REI_RAG_MIN_SCORE', '0.25'))
# embedding 服务超时（秒）；服务慢/不可用时快速失败，避免拖住每次回答
EMBED_TIMEOUT = float(os.environ.get('REI_EMBED_TIMEOUT', '8'))
# 切块参数：块目标长度 / 相邻块重叠（字符数）
CHUNK_SIZE = int(os.environ.get('REI_RAG_CHUNK_SIZE', '700'))
CHUNK_OVERLAP = int(os.environ.get('REI_RAG_CHUNK_OVERLAP', '120'))
# 注入 prompt 时每条内容的最大长度（防止长文撑爆上下文）
CTX_MAX_CHARS = int(os.environ.get('REI_RAG_CTX_MAX_CHARS', '500'))

# Django 内容来源同步配置
DJANGO_API = os.environ.get('REI_DJANGO_API', 'http://localhost:19424/api')
SYNC_TTL = float(os.environ.get('REI_SYNC_TTL', '300'))  # 同步节流（秒）
_last_sync = {}  # source -> 上次同步时间戳
_sync_lock = threading.Lock()
_bg_syncing = False

# 各来源的列表/详情接口；detail 不为 None 表示列表不含正文，需逐条取详情
SOURCE_FEEDS = {
    'kb': {'list': f'{DJANGO_API}/knowledge/articles/', 'detail': f'{DJANGO_API}/knowledge/articles/{{id}}/'},
    'qa': {'list': f'{DJANGO_API}/qa/questions/',       'detail': None},
}

SOURCE_LABEL = {'memory': '记忆', 'kb': '知识库', 'qa': '问答'}

# 语料矩阵缓存：generation 在任何写入后自增，检索时发现代次变了才重建矩阵
_corpus_generation = 0
_corpus_cache = {}  # key=(sources) -> {'gen', 'ts', 'items', 'mat'}
CORPUS_TTL = float(os.environ.get('REI_RAG_CORPUS_TTL', '30'))  # 记忆库外部写入的兜底刷新

# 查询向量 LRU 缓存
_query_cache = OrderedDict()
QUERY_CACHE_MAX = 128


def bump_generation():
    """语料有写入（记忆增删改 / 同步更新）后调用，使矩阵缓存失效"""
    global _corpus_generation
    _corpus_generation += 1


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
    """查询向量（带 LRU 缓存：重复/相同问题不重复调 embedding 服务）"""
    key = hashlib.md5(text.encode('utf-8')).hexdigest()
    if key in _query_cache:
        _query_cache.move_to_end(key)
        return _query_cache[key]
    vec = embed_texts([text])[0]
    _query_cache[key] = vec
    if len(_query_cache) > QUERY_CACHE_MAX:
        _query_cache.popitem(last=False)
    return vec


def split_chunks(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """把长文按段落切块：优先在段落边界断开，段落装不下再硬切（带重叠）。
    返回非空块列表；短文本返回单块。"""
    text = (text or '').strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]

    paras = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
    chunks, buf = [], ''
    for p in paras:
        # 单段超长：硬切（带重叠，避免语义在边界丢失）
        while len(p) > size:
            if buf:
                chunks.append(buf)
                buf = ''
            chunks.append(p[:size])
            p = p[size - overlap:]
        if buf and len(buf) + len(p) + 1 > size:
            chunks.append(buf)
            # 新块开头带上一块结尾做重叠
            buf = (chunks[-1][-overlap:] + '\n' + p) if overlap else p
        else:
            buf = f'{buf}\n{p}' if buf else p
    if buf:
        chunks.append(buf)
    return [c.strip() for c in chunks if c.strip()]


def _cosine(a, b):
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)


def compute_item_embedding(title, content):
    """为单条记忆生成向量（title + content 拼接，截到块长）；失败返回 None"""
    text = f'{title}\n{content}'.strip()
    if not text:
        return None
    try:
        return embed_texts([text[:CHUNK_SIZE * 2]])[0].tolist()
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
    受 SYNC_TTL 节流；列表不含正文的来源（如 kb）会逐条取详情。
    长文切块后逐块生成向量（一次批量 embedding 调用）。"""
    feed = SOURCE_FEEDS.get(source)
    if not feed:
        return
    if not force and (time.time() - _last_sync.get(source, 0)) < SYNC_TTL:
        return
    from database import get_chunk_hashes, replace_item_chunks, delete_chunks_not_in
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
            # 未变化的条目先用 title 做 hash 预判？不行——正文变化不反映在列表里，
            # 但详情请求也只在 TTL 到期后才发生，成本可接受
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
        texts = split_chunks(content) or ['']
        try:
            embs = embed_texts([f'{title}\n{t}'.strip()[:CHUNK_SIZE * 2] for t in texts])
        except Exception as e:
            logger.error(f'[RAG] {source} 条目 {eid} 向量生成失败: {e}')
            continue
        replace_item_chunks(source, eid, title,
                            list(zip(texts, [e.tolist() for e in embs])), h)
        changed += 1
    delete_chunks_not_in(source, seen)
    if changed:
        bump_generation()
    logger.info(f'[RAG] {source} 同步完成: {len(seen)} 条，{changed} 条更新向量')


def sync_all(force=False):
    """同步所有 Django 来源（知识库 + 问答）"""
    for source in SOURCE_FEEDS:
        sync_source(source, force=force)


def _sync_in_background():
    """后台线程做同步，避免阻塞检索路径；同一时间只跑一个"""
    global _bg_syncing
    with _sync_lock:
        if _bg_syncing:
            return
        _bg_syncing = True

    def _run():
        global _bg_syncing
        try:
            sync_all()
        finally:
            _bg_syncing = False

    threading.Thread(target=_run, daemon=True).start()


def _load_corpus(sources):
    """汇总检索语料；每条带 source 标记。语料为空的来源做一次阻塞同步（冷启动），
    否则同步移入后台线程，本次先用现有缓存。"""
    from database import load_items_with_embeddings, load_chunks
    corpus = []
    if 'memory' in sources:
        for it in load_items_with_embeddings():
            if it.get('embedding'):
                corpus.append({**it, 'source': 'memory'})
    need_bg_sync = False
    for source in SOURCE_FEEDS:
        if source in sources:
            rows = [c for c in load_chunks(source) if c.get('embedding')]
            if not rows:
                # 冷启动：本地还没有该来源缓存，阻塞同步一次
                sync_source(source)
                rows = [c for c in load_chunks(source) if c.get('embedding')]
            elif (time.time() - _last_sync.get(source, 0)) >= SYNC_TTL:
                need_bg_sync = True
            corpus.extend({**c, 'source': source} for c in rows)
    if need_bg_sync:
        _sync_in_background()
    return corpus


def _get_matrix(sources):
    """返回 (items, 归一化矩阵)。语料代次未变且未过期时直接复用缓存矩阵。"""
    key = tuple(sorted(sources))
    ent = _corpus_cache.get(key)
    now = time.time()
    if ent and ent['gen'] == _corpus_generation and (now - ent['ts']) < CORPUS_TTL:
        return ent['items'], ent['mat']

    corpus = _load_corpus(sources)
    if not corpus:
        return [], None
    # 只保留维度一致的向量（服务换模型后维度可能不同）
    dims = {}
    for it in corpus:
        d = len(it['embedding'])
        dims[d] = dims.get(d, 0) + 1
    main_dim = max(dims, key=dims.get)
    items = [it for it in corpus if len(it['embedding']) == main_dim]

    mat = np.asarray([it['embedding'] for it in items], dtype=np.float32)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    mat = mat / norms
    _corpus_cache[key] = {'gen': _corpus_generation, 'ts': now, 'items': items, 'mat': mat}
    return items, mat


_WORD_RE = re.compile(r'[a-zA-Z0-9]+|[一-鿿]')


def _keyword_boost(query, title):
    """标题关键词重合的轻量加分（混合检索：弥补纯向量对专名/代号不敏感）"""
    q = set(_WORD_RE.findall(query.lower()))
    t = set(_WORD_RE.findall((title or '').lower()))
    if not q or not t:
        return 0.0
    return 0.1 * len(q & t) / len(q)


def retrieve(query, top_k=TOP_K, min_score=MIN_SCORE, sources=('memory', 'kb', 'qa')):
    """在记忆库 + 知识库 + 问答中按语义相似度检索，返回 [(item_dict, score), ...]（按分数降序）。
    item_dict 含 source('memory'|'kb'|'qa')、id、title、content。
    同一条内容多块时取最高分块（去重），content 为命中的那一块。"""
    items, mat = _get_matrix(sources)
    if mat is None:
        return []
    try:
        q = embed_query(query)
    except Exception as e:
        logger.error(f'[RAG] query embedding 失败: {e}')
        return []
    if q.shape[0] != mat.shape[1]:
        logger.error(f'[RAG] 查询向量维度 {q.shape[0]} 与语料 {mat.shape[1]} 不一致')
        return []

    qn = float(np.linalg.norm(q)) or 1.0
    scores = mat @ (q / qn)  # 一次矩阵乘法得到全部余弦相似度

    # 同一条内容（source, id）只保留最高分块，并加标题关键词分
    best = {}
    for i, it in enumerate(items):
        s = float(scores[i]) + _keyword_boost(query, it.get('title', ''))
        k = (it['source'], it['id'])
        if k not in best or s > best[k][1]:
            best[k] = (it, s)

    ranked = sorted(best.values(), key=lambda x: x[1], reverse=True)
    return [(it, s) for it, s in ranked[:top_k] if s >= min_score]


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
    if n:
        bump_generation()
    logger.info(f'[RAG] 已补齐 {n}/{len(missing)} 条记忆向量')
    return n


def format_context(hits):
    """把检索结果格式化为可注入 prompt 的文本（每条截断，防止长文撑爆上下文）"""
    if not hits:
        return ''
    lines = ['以下是从知识库和记忆库检索到的相关信息，可作为回答参考（如不相关请忽略）：']
    for it, score in hits:
        src = SOURCE_LABEL.get(it.get('source', ''), '')
        content = (it.get('content') or '').strip()
        if len(content) > CTX_MAX_CHARS:
            content = content[:CTX_MAX_CHARS] + '…'
        lines.append(f'- [{src} ID={it["id"]} 相关度={score:.2f}] {it["title"]}：{content}')
    return '\n'.join(lines)
