"""内容审核 — 违禁词过滤

违禁词列表来自 settings.BLOCKED_WORDS（可随时增删，无需改代码）。
发布文章/问答时调用 find_blocked_words() 检查标题与正文。
"""
from django.conf import settings


def get_blocked_words():
    return getattr(settings, 'BLOCKED_WORDS', []) or []


def find_blocked_words(*texts):
    """返回文本中命中的违禁词（去重、保持配置顺序，大小写不敏感）。"""
    combined = ' '.join(t for t in texts if t).lower()
    hits = []
    for w in get_blocked_words():
        if w and w.lower() in combined and w not in hits:
            hits.append(w)
    return hits


def blocked_words_error(*texts):
    """命中违禁词时返回提示信息字符串，否则返回 None。"""
    hits = find_blocked_words(*texts)
    if hits:
        return f'内容包含违禁词：{"、".join(hits)}，请修改后再发布'
    return None
