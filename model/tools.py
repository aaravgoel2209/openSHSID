"""
Tool 注册表 — 为 Rei 提供函数调用能力
每个 tool 定义遵循 OpenAI function calling 格式
"""
import json
import time
import logging

logger = logging.getLogger(__name__)


# ── Bing 搜索 ────────────────────────────────────────────

BING_SEARCH_DEF = {
    "type": "function",
    "function": {
        "name": "bing_search",
        "description": "搜索网络信息，当用户询问实时新闻、最新资讯、或搜索知识库，记忆之外的内容时使用",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词"
                },
                "count": {
                    "type": "integer",
                    "description": "返回结果数量，默认 5",
                    "default": 5
                }
            },
            "required": ["query"]
        }
    }
}


def bing_search(query, count=5):
    """爬取必应网页版搜索结果"""
    import requests
    from bs4 import BeautifulSoup

    base_url = "https://cn.bing.com/search"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }

    results = []
    page = 0

    try:
        while len(results) < count:
            params = {"q": query, "first": page * 10 + 1, "FORM": "PORE"}
            resp = requests.get(base_url, params=params, headers=headers, timeout=15)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = soup.select("li.b_algo") or soup.select("div.b_algo")

            for item in items:
                title_elem = item.select_one("h2 a")
                if not title_elem:
                    continue
                title = title_elem.get_text(strip=True)
                link = title_elem.get("href")
                snippet_elem = item.select_one(".b_caption p, .b_algoSlug")
                snippet = snippet_elem.get_text(strip=True) if snippet_elem else ""
                if title and link:
                    results.append({"title": title, "url": link, "snippet": snippet})
                    if len(results) >= count:
                        break

            if not items:
                break
            page += 1
            time.sleep(1)
    except Exception as e:
        logger.error(f'[Bing] 搜索失败: {e}')
        return f'搜索失败: {e}'

    if not results:
        return '未找到相关结果。'

    lines = [f'找到 {len(results)} 条结果:']
    for i, r in enumerate(results[:count], 1):
        lines.append(f'\n{i}. {r["title"]}')
        lines.append(f'   {r["snippet"]}')
        lines.append(f'   {r["url"]}')
    return '\n'.join(lines)


# ── 数据库工具定义 ─────────────────────────────────────

MEMORY_SEARCH_DEF = {
    "type": "function",
    "function": {
        "name": "memory_search",
        "description": "在本地记忆库中按语义检索相关条目（RAG），返回最相关的条目 ID、相关度和标题。用自然语言描述要找的内容即可，不必精确匹配关键词。",
        "parameters": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string", "description": "要检索的内容描述或关键词"}
            },
            "required": ["keyword"]
        }
    }
}

MEMORY_READ_DEF = {
    "type": "function",
    "function": {
        "name": "memory_read",
        "description": "根据条目 ID 从本地数据库读取完整内容",
        "parameters": {
            "type": "object",
            "properties": {
                "item_id": {"type": "integer", "description": "条目 ID"}
            },
            "required": ["item_id"]
        }
    }
}

MEMORY_CREATE_DEF = {
    "type": "function",
    "function": {
        "name": "memory_create",
        "description": "在本地数据库中新建一条记录，包含标题和内容，在获取知识库后发现新的信息时优先调用创建一条新记忆",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "标题"},
                "content": {"type": "string", "description": "内容"}
            },
            "required": ["title", "content"]
        }
    }
}

MEMORY_UPDATE_DEF = {
    "type": "function",
    "function": {
        "name": "memory_update",
        "description": "根据条目 ID 更新本地数据库中某条记录的内容",
        "parameters": {
            "type": "object",
            "properties": {
                "item_id": {"type": "integer", "description": "条目 ID"},
                "content": {"type": "string", "description": "新的内容"}
            },
            "required": ["item_id", "content"]
        }
    }
}


# ── 数据库工具实现 ──────────────────────────────────

def _embed_item(item_id, title, content):
    """为记忆条目生成并保存语义向量（best-effort，失败不影响写入）"""
    try:
        import rag
        from database import save_item_embedding
        emb = rag.compute_item_embedding(title, content)
        if emb:
            save_item_embedding(item_id, emb)
    except Exception as e:
        logger.error(f'[Memory] 生成向量失败 id={item_id}: {e}')


def _memory_search_fallback(keyword):
    """字符模糊匹配：关键词中至少 2 个字符出现在标题中（向量不可用时回退）"""
    from database import get_conn
    conn = get_conn()
    rows = conn.execute('SELECT id, title FROM items').fetchall()
    conn.close()
    chars = set(keyword)
    matched = [r for r in rows if sum(1 for c in chars if c in r['title']) >= 2]
    if not matched:
        return '未找到匹配的条目。'
    return '\n'.join(f'ID={r["id"]} 标题={r["title"]}' for r in matched)


def memory_search(keyword):
    # 仅在记忆库内语义检索（RAG）；失败或无结果时回退字符模糊匹配
    try:
        import rag
        hits = rag.retrieve(keyword, top_k=5, min_score=0.0, sources=('memory',))
        if hits:
            return '\n'.join(
                f'ID={it["id"]} 相关度={s:.2f} 标题={it["title"]}' for it, s in hits
            )
    except Exception as e:
        logger.error(f'[Memory] 语义检索失败，回退字符匹配: {e}')
    return _memory_search_fallback(keyword)


def rag_search(query, top_k=6):
    """在知识库 + 记忆库中做语义检索（RAG），返回带来源/ID/相关度/标题的排序结果"""
    try:
        import rag
        hits = rag.retrieve(query, top_k=top_k, min_score=0.0)
    except Exception as e:
        logger.error(f'[RAG] rag_search 失败: {e}')
        return f'检索失败: {e}'
    if not hits:
        return '未检索到相关内容。'
    label = {'kb': '知识库', 'qa': '问答', 'memory': '记忆'}
    lines = ['语义检索结果（用 kb_read / qa_read / memory_read 读取对应条目全文）：']
    for it, s in hits:
        src = label.get(it.get('source'), it.get('source', ''))
        lines.append(f'[{src}] ID={it["id"]} 相关度={s:.2f} 标题={it["title"]}')
    return '\n'.join(lines)


def memory_read(item_id):
    from database import get_conn
    conn = get_conn()
    row = conn.execute('SELECT * FROM items WHERE id=?', (item_id,)).fetchone()
    conn.close()
    if not row:
        return f'未找到 ID={item_id} 的条目。'
    return f'ID={row["id"]}\n标题={row["title"]}\n内容={row["content"]}'


def memory_create(title, content):
    from database import get_conn
    conn = get_conn()
    cur = conn.execute('INSERT INTO items (title, content) VALUES (?, ?)', (title, content))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    _embed_item(new_id, title, content)
    return f'已创建条目 ID={new_id} title="{title}"'


def memory_update(item_id, content):
    from database import get_conn
    conn = get_conn()
    cur = conn.execute('UPDATE items SET content=? WHERE id=?', (content, item_id))
    conn.commit()
    affected = cur.rowcount
    row = conn.execute('SELECT title FROM items WHERE id=?', (item_id,)).fetchone()
    conn.close()
    if affected == 0:
        return f'未找到 ID={item_id} 的条目。'
    # 内容变了，重算向量
    _embed_item(item_id, row['title'] if row else '', content)
    return f'已更新 ID={item_id} 的内容。'


# ── RAG 语义检索工具定义 ──────────────────────────────

RAG_SEARCH_DEF = {
    "type": "function",
    "function": {
        "name": "rag_search",
        "description": "在知识库、问答区和记忆库中做语义检索（RAG），用自然语言描述要找的内容即可，返回最相关条目的来源、ID、相关度和标题。需要查资料或回忆信息时优先用它；拿到结果后再用 kb_read（知识库）/ qa_read（问答）/ memory_read（记忆）读取全文。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "要检索的问题或内容描述"}
            },
            "required": ["query"]
        }
    }
}


# ── 知识库工具定义 ────────────────────────────────────

KB_SEARCH_DEF = {
    "type": "function",
    "function": {
        "name": "kb_search",
        "description": "在知识库中按关键词搜索文章标题，返回匹配的文章 ID 和标题",
        "parameters": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string", "description": "搜索关键词，不要使用空格来一次多搜"}
            },
            "required": ["keyword"]
        }
    }
}

KB_LIST_DEF = {
    "type": "function",
    "function": {
        "name": "kb_list",
        "description": "列出知识库中的全部文章（返回每篇的 ID 和标题），用于浏览有哪些文章；之后可用 kb_read 读取某篇全文",
        "parameters": {"type": "object", "properties": {}},
    }
}

KB_READ_DEF = {
    "type": "function",
    "function": {
        "name": "kb_read",
        "description": "根据文章 ID 从知识库读取文章完整标题和内容，获取到内容后记得根据新发现的东西创建一条记忆",
        "parameters": {
            "type": "object",
            "properties": {
                "article_id": {"type": "integer", "description": "文章 ID"}
            },
            "required": ["article_id"]
        }
    }
}


# ── 知识库工具实现 ──────────────────────────────────

DJANGO_API = 'http://localhost:19424/api'


def _api_get(url):
    """GET Django 接口并解析 JSON，绕过系统代理（localhost 直连）"""
    import urllib.request, json
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(url, timeout=8) as r:
        return json.loads(r.read())


def kb_search(keyword):
    import urllib.parse
    url = f'{DJANGO_API}/knowledge/articles/?search={urllib.parse.quote(keyword)}'
    try:
        data = _api_get(url)
    except Exception as e:
        logger.error(f'[KB] 搜索失败: {e}')
        return f'搜索失败: {e}'
    if not data:
        return '未找到匹配的文章。'
    return '\n'.join(f'ID={a["id"]} 标题={a["title"]}' for a in data)


def kb_list():
    url = f'{DJANGO_API}/knowledge/articles/'
    try:
        data = _api_get(url)
    except Exception as e:
        logger.error(f'[KB] 列表失败: {e}')
        return f'获取失败: {e}'
    if not data:
        return '知识库暂无文章。'
    lines = [f'知识库共 {len(data)} 篇文章：']
    lines.extend(f'ID={a["id"]} 标题={a["title"]}' for a in data)
    return '\n'.join(lines)


def kb_read(article_id):
    url = f'{DJANGO_API}/knowledge/articles/{article_id}/'
    try:
        a = _api_get(url)
    except Exception as e:
        logger.error(f'[KB] 读取失败: {e}')
        return f'读取失败: {e}'
    return f'ID={a["id"]}\n标题={a["title"]}\n内容={a["content"]}'


# ── 问答（Q&A）工具定义 ────────────────────────────────

QA_SEARCH_DEF = {
    "type": "function",
    "function": {
        "name": "qa_search",
        "description": "在问答区按关键词搜索问题标题/内容，返回匹配的问题 ID 和标题",
        "parameters": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string", "description": "搜索关键词"}
            },
            "required": ["keyword"]
        }
    }
}

QA_READ_DEF = {
    "type": "function",
    "function": {
        "name": "qa_read",
        "description": "根据问题 ID 读取问答帖的完整内容，包括问题正文和全部回答（含嵌套回复）",
        "parameters": {
            "type": "object",
            "properties": {
                "question_id": {"type": "integer", "description": "问题 ID"}
            },
            "required": ["question_id"]
        }
    }
}


# ── 问答（Q&A）工具实现 ──────────────────────────────

def qa_search(keyword):
    import urllib.parse
    url = f'{DJANGO_API}/qa/questions/?search={urllib.parse.quote(keyword)}'
    try:
        data = _api_get(url)
    except Exception as e:
        logger.error(f'[QA] 搜索失败: {e}')
        return f'搜索失败: {e}'
    if not data:
        return '未找到匹配的问题。'
    return '\n'.join(f'ID={q["id"]} 标题={q["title"]}' for q in data)


def _format_answers(answers, depth=0):
    lines = []
    for ans in answers:
        indent = '  ' * depth
        author = ans.get('author_name') or '匿名'
        lines.append(f'{indent}- [{author}] {ans.get("content", "")}')
        replies = ans.get('replies') or []
        if replies:
            lines.extend(_format_answers(replies, depth + 1))
    return lines


def qa_read(question_id):
    url = f'{DJANGO_API}/qa/questions/{question_id}/'
    try:
        q = _api_get(url)
    except Exception as e:
        logger.error(f'[QA] 读取失败: {e}')
        return f'读取失败: {e}'
    lines = [
        f'问题 ID={q["id"]}',
        f'标题：{q.get("title", "")}',
        f'内容：{q.get("content", "")}',
    ]
    answers = q.get('answers') or []
    if answers:
        lines.append(f'\n回答（{len(answers)} 条）：')
        lines.extend(_format_answers(answers))
    else:
        lines.append('\n（暂无回答）')
    return '\n'.join(lines)


# ── 天气工具 ───────────────────────────────────────────

WEATHER_DEF = {
    "type": "function",
    "function": {
        "name": "get_current_weather",
        "description": "获取指定城市的当前天气信息",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "城市和国家/地区，如 东京,日本"}
            },
            "required": ["location"]
        }
    }
}


def get_current_weather(location):
    """调用 wttr.in 获取天气"""
    import urllib.request, json, urllib.parse
    url = f'https://wttr.in/{urllib.parse.quote(location)}?format=j1'
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read())
        cur = data['current_condition'][0]
        desc = cur['weatherDesc'][0]['value']
        temp = cur['temp_C']
        feel = cur['FeelsLikeC']
        humidity = cur['humidity']
        wind = cur['windspeedKmph']
        return f'{location} 当前天气：{desc}，气温 {temp}°C（体感 {feel}°C），湿度 {humidity}%，风速 {wind} km/h'
    except Exception as e:
        logger.error(f'[Weather] 获取天气失败: {e}')
        return f'获取天气失败: {e}'


# ── 注册表 ──────────────────────────────────────────────

TOOLS = [
    # BING_SEARCH_DEF,
    RAG_SEARCH_DEF,
    MEMORY_SEARCH_DEF,
    MEMORY_READ_DEF,
    MEMORY_CREATE_DEF,
    MEMORY_UPDATE_DEF,
    KB_LIST_DEF,
    KB_SEARCH_DEF,
    KB_READ_DEF,
    QA_SEARCH_DEF,
    QA_READ_DEF,
    WEATHER_DEF,
]


def handle_tool_call(name, arguments):
    if name == 'bing_search':
        query = arguments.get('query', '')
        count = arguments.get('count', 5)
        logger.info(f'[Tool] Bing 搜索: query="{query}" count={count}')
        return bing_search(query, count)

    if name == 'rag_search':
        query = arguments.get('query', '')
        logger.info(f'[Tool] RAG 语义检索: query="{query}"')
        return rag_search(query)

    if name == 'memory_search':
        kw = arguments.get('keyword', '')
        logger.info(f'[Tool] DB 搜索: keyword="{kw}"')
        return memory_search(kw)

    if name == 'memory_read':
        item_id = arguments.get('item_id', 0)
        logger.info(f'[Tool] DB 读取: id={item_id}')
        return memory_read(item_id)

    if name == 'memory_create':
        title = arguments.get('title', '')
        content = arguments.get('content', '')
        logger.info(f'[Tool] DB 创建: title="{title}"')
        return memory_create(title, content)

    if name == 'memory_update':
        item_id = arguments.get('item_id', 0)
        content = arguments.get('content', '')
        logger.info(f'[Tool] DB 更新: id={item_id}')
        return memory_update(item_id, content)

    if name == 'kb_list':
        logger.info('[Tool] KB 列表')
        return kb_list()

    if name == 'kb_search':
        kw = arguments.get('keyword', '')
        logger.info(f'[Tool] KB 搜索: keyword="{kw}"')
        return kb_search(kw)

    if name == 'kb_read':
        aid = arguments.get('article_id', 0)
        logger.info(f'[Tool] KB 读取: id={aid}')
        return kb_read(aid)

    if name == 'qa_search':
        kw = arguments.get('keyword', '')
        logger.info(f'[Tool] QA 搜索: keyword="{kw}"')
        return qa_search(kw)

    if name == 'qa_read':
        qid = arguments.get('question_id', 0)
        logger.info(f'[Tool] QA 读取: id={qid}')
        return qa_read(qid)

    if name == 'get_current_weather':
        loc = arguments.get('location', '')
        logger.info(f'[Tool] 天气查询: location="{loc}"')
        return get_current_weather(loc)

    logger.warning(f'[Tool] 未知工具调用: {name} args={arguments}')
    return f'错误：未知工具 "{name}"'
