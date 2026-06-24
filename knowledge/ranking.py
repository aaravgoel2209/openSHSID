"""
轻量排名引擎 — 内联在 Django 中，避免 Flask HTTP 开销
"""
import time
import math

# 必须与 model/config.py 保持一致
PUSH_MODE = "algorithm"  # "algorithm" | "model"

HEAT_INIT = 2.0
HEAT_CLICK = 0.1
HEAT_LIKE = 0.3

# 简单缓存: key=user_id → {"articles": [...], "expires": timestamp}
_cache = {}
CACHE_TTL = 5  # 缓存 5 秒


def score_item_algorithm(item_emb, user_emb, heat):
    """算法: avg(max(item * heat - user, 0)) * 10"""
    s = 0.0
    for i in range(len(item_emb)):
        diff = item_emb[i] * heat - user_emb[i]
        if diff > 0:
            s += diff
    return (s / len(item_emb)) * 10.0


def rank_articles(articles_data, user_emb, user_id=None, show_score=False):
    """
    articles_data: list of dict (含 embedding, views, like_count)
    user_emb: list[float] 32维
    user_id: 可选，用于缓存
    show_score: 是否在每篇文章中注入 push_score 字段
    返回: 排序后的 articles_data
    """
    if not articles_data or not articles_data[0].get('embedding'):
        return articles_data

    # 缓存命中（不含分数，仅用于排序）
    if not show_score and user_id is not None and user_id in _cache:
        entry = _cache[user_id]
        if entry['expires'] > time.time():
            return entry['articles']

    scored = []
    for a in articles_data:
        created = a.get('created_at', '')
        if created:
            try:
                from datetime import datetime, timezone
                dt = datetime.fromisoformat(created)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                days = (datetime.now(timezone.utc) - dt).days
            except Exception:
                days = 0
        else:
            days = 0
        heat = HEAT_INIT + (a.get('views', 0) or 0) * HEAT_CLICK + (a.get('like_count', 0) or 0) * HEAT_LIKE - days * 0.1
        if PUSH_MODE == "algorithm":
            score = score_item_algorithm(a['embedding'], user_emb, heat)
        else:
            score = heat
        if show_score:
            a = dict(a)
            a['push_score'] = round(score, 4)
        scored.append((score, a))

    scored.sort(key=lambda x: x[0], reverse=True)
    result = [a for _, a in scored]

    if not show_score and user_id is not None:
        _cache[user_id] = {'articles': result, 'expires': time.time() + CACHE_TTL}

    return result
