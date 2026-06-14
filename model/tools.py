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
        "description": "在本地数据库中按标题模糊搜索条目，返回匹配的条目 ID 和标题",
        "parameters": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string", "description": "搜索关键词"}
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

def memory_search(keyword):
    from database import get_conn
    conn = get_conn()
    rows = conn.execute('SELECT id, title FROM items').fetchall()
    conn.close()

    # 模糊匹配：关键词中至少 2 个字符出现在标题中
    chars = set(keyword)
    matched = [r for r in rows if sum(1 for c in chars if c in r['title']) >= 2]

    if not matched:
        return '未找到匹配的条目。'
    return '\n'.join(f'ID={r["id"]} 标题={r["title"]}' for r in matched)


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
    return f'已创建条目 ID={new_id} title="{title}"'


def memory_update(item_id, content):
    from database import get_conn
    conn = get_conn()
    cur = conn.execute('UPDATE items SET content=? WHERE id=?', (content, item_id))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    if affected == 0:
        return f'未找到 ID={item_id} 的条目。'
    return f'已更新 ID={item_id} 的内容。'


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

def kb_search(keyword):
    import urllib.request, urllib.parse, json
    url = f'http://localhost:19424/api/knowledge/articles/?search={urllib.parse.quote(keyword)}'
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            data = json.loads(r.read())
    except Exception as e:
        logger.error(f'[KB] 搜索失败: {e}')
        return f'搜索失败: {e}'
    if not data:
        return '未找到匹配的文章。'
    return '\n'.join(f'ID={a["id"]} 标题={a["title"]}' for a in data)


def kb_read(article_id):
    import urllib.request, json
    url = f'http://localhost:19424/api/knowledge/articles/{article_id}/'
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            a = json.loads(r.read())
    except Exception as e:
        logger.error(f'[KB] 读取失败: {e}')
        return f'读取失败: {e}'
    return f'ID={a["id"]}\n标题={a["title"]}\n内容={a["content"]}'


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
    MEMORY_SEARCH_DEF,
    MEMORY_READ_DEF,
    MEMORY_CREATE_DEF,
    MEMORY_UPDATE_DEF,
    KB_SEARCH_DEF,
    KB_READ_DEF,
    WEATHER_DEF,
]


def handle_tool_call(name, arguments):
    if name == 'bing_search':
        query = arguments.get('query', '')
        count = arguments.get('count', 5)
        logger.info(f'[Tool] Bing 搜索: query="{query}" count={count}')
        return bing_search(query, count)

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

    if name == 'kb_search':
        kw = arguments.get('keyword', '')
        logger.info(f'[Tool] KB 搜索: keyword="{kw}"')
        return kb_search(kw)

    if name == 'kb_read':
        aid = arguments.get('article_id', 0)
        logger.info(f'[Tool] KB 读取: id={aid}')
        return kb_read(aid)

    if name == 'get_current_weather':
        loc = arguments.get('location', '')
        logger.info(f'[Tool] 天气查询: location="{loc}"')
        return get_current_weather(loc)

    logger.warning(f'[Tool] 未知工具调用: {name} args={arguments}')
    return f'错误：未知工具 "{name}"'
