"""
热度配置 — 用于计算 item_vector * heat 中的 heat 值

所有数值集中在 config.json 的 ranking 段（model 侧唯一事实来源，
Django 侧 knowledge/ranking.py 也从同一配置读取）。
"""

import torch

from config_loader import cfg

RANK_CFG = cfg['ranking']

# 推送模式: "model" = 神经网络模型  |  "algorithm" = 算法公式
PUSH_MODE = RANK_CFG['push_mode']

HEAT_CONFIG = RANK_CFG['heat']


def calc_heat(clicks: int, skips: int, likes: int, comments: int) -> float:
    """根据用户行为计算热度值"""
    h = HEAT_CONFIG["initial"]
    h += clicks * HEAT_CONFIG["click"]
    h += skips * HEAT_CONFIG["skip"]
    h += likes * HEAT_CONFIG["like"]
    h += comments * HEAT_CONFIG["comment"]
    return round(max(0.0, h), 4)


def score_item(item_emb, user_emb, heat) -> float:
    """
    对一篇文章/问答计算排序分数
    算法: avg(max(item * heat - user, 0)) * 10
    """
    item = torch.tensor(item_emb, dtype=torch.float32) * heat
    user = torch.tensor(user_emb, dtype=torch.float32)
    diff = torch.clamp(item - user, min=0)
    return diff.mean().item() * RANK_CFG['score_multiplier']


def _update(src: list, tgt: list, magnitude: float) -> list:
    """src = src * (1 - cr * mag) + tgt * 0.1 * mag"""
    import torch
    cr = HEAT_CONFIG["change_rate"]
    s = torch.tensor(src, dtype=torch.float32)
    t = torch.tensor(tgt, dtype=torch.float32)
    return (s * (1 - cr * magnitude) + t * cr * magnitude).tolist()


def update_item_embedding(item_emb: list, user_emb: list, action: str) -> list:
    """用户行为后更新文章/问答向量"""
    mag = HEAT_CONFIG.get(action, 0)
    return _update(item_emb, user_emb, mag) if mag else item_emb


def update_user_embedding(user_emb: list, item_emb: list, action: str) -> list:
    """用户行为后更新用户向量（参数交换）"""
    mag = HEAT_CONFIG.get(action, 0)
    return _update(user_emb, item_emb, mag) if mag else user_emb
