"""
BPR (Bayesian Personalised Ranking) 强化学习训练
- 对每个 impression，将 clicked items 与 non-clicked items 两两配对
- 最大化 P(clicked > non-clicked)，方差远低于 REINFORCE
- 梯度裁剪防止爆炸，每 SAVE_INTERVAL 步保存一次模型
"""
import json
import time
import logging
import torch
import torch.nn.functional as F
from model import RecoModel

from config_loader import cfg, ROOT

logger = logging.getLogger(__name__)

TRAIN_CFG = cfg['training']
DATA_DIR = ROOT / TRAIN_CFG['data_dir']
DATA_DIR.mkdir(exist_ok=True)
MODEL_PATH = ROOT / TRAIN_CFG['model_path']
LOG_PATH = ROOT / TRAIN_CFG['log_path']

SAVE_INTERVAL = TRAIN_CFG['save_interval']   # 每 N 步保存一次模型
MAX_GRAD_NORM = TRAIN_CFG['max_grad_norm']   # 梯度裁剪上限


def load_model() -> RecoModel:
    m = RecoModel()
    if MODEL_PATH.exists():
        state = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
        # 兼容旧版单编码器权重（键名不匹配时重新初始化）
        try:
            m.load_state_dict(state)
            n = sum(p.numel() for p in m.parameters())
            logger.info(f'[load] 从 {MODEL_PATH} 加载模型 ({n:,} 参数)')
        except RuntimeError:
            logger.warning('[load] 权重结构不兼容，使用随机初始化（旧模型已跳过）')
    else:
        logger.info('[load] 未找到已有模型，使用随机初始化')
    return m


def save_model(m: RecoModel):
    torch.save(m.state_dict(), MODEL_PATH)
    size_kb = MODEL_PATH.stat().st_size / 1024
    logger.info(f'[save] 模型已保存 → {MODEL_PATH} ({size_kb:.1f} KB)')


def rank(model: RecoModel, item_embs, user_emb, heats):
    """
    item_embs : list of list[float]  32-dim
    user_emb  : list[float]          32-dim
    heats     : list[float]
    返回: (ordered_indices, scores) 按得分降序
    """
    from config import PUSH_MODE, score_item

    t0 = time.perf_counter()
    n_items = len(item_embs)
    if n_items == 0:
        return [], []

    scores = []
    if PUSH_MODE == "model":
        model.eval()
        user_t = torch.tensor(user_emb, dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            for i, (emb, h) in enumerate(zip(item_embs, heats)):
                item_t = torch.tensor(emb, dtype=torch.float32).unsqueeze(0) * h
                s = model(item_t, user_t).item()
                scores.append((i, s))
        mode_label = "model"
    else:
        for i, (emb, h) in enumerate(zip(item_embs, heats)):
            s = score_item(emb, user_emb, h)
            scores.append((i, s))
        mode_label = "algorithm"

    scores.sort(key=lambda x: x[1], reverse=True)
    ordered = [idx for idx, _ in scores]
    vals = [s for _, s in scores]
    elapsed = (time.perf_counter() - t0) * 1000
    logger.info(
        f'[rank] mode={mode_label} 物品={n_items} 耗时={elapsed:.1f}ms '
        f'最高={vals[0]:.4f} 最低={vals[-1]:.4f} 均值={sum(vals)/len(vals):.4f}'
    )
    return ordered, vals


def _bpr_loss(
    model: RecoModel,
    user_t: torch.Tensor,
    clicked_items: list,
    skipped_items: list,
) -> torch.Tensor:
    """
    BPR 成对排序损失。
    对 clicked × skipped 所有配对计算 -log(sigmoid(s_pos - s_neg))。
    若只有一类（全点击或全跳过），退化为 BCE。
    """
    def item_logit(item: dict) -> torch.Tensor:
        item_t = torch.tensor(item["emb"], dtype=torch.float32).unsqueeze(0) * item["heat"]
        return model.score_logit(item_t, user_t)  # shape: (1,)

    if clicked_items and skipped_items:
        # 成对 BPR
        pos_logits = torch.stack([item_logit(i) for i in clicked_items])   # (P,)
        neg_logits = torch.stack([item_logit(i) for i in skipped_items])   # (N,)
        # 所有 P×N 配对
        diff = pos_logits.unsqueeze(1) - neg_logits.unsqueeze(0)           # (P, N)
        loss = -F.logsigmoid(diff).mean()
    elif clicked_items:
        # 全点击：最大化分数（拉向高分）
        logits = torch.stack([item_logit(i) for i in clicked_items])
        loss = -F.logsigmoid(logits).mean()
    else:
        # 全跳过：最小化分数（拉向低分）
        logits = torch.stack([item_logit(i) for i in skipped_items])
        loss = -F.logsigmoid(-logits).mean()

    return loss


def train_step(model: RecoModel, optimizer: torch.optim.Optimizer, impression_log: dict) -> float:
    """
    impression_log: {
        "user_emb": [...],
        "items": [{"idx": int, "emb": [...], "heat": float, "clicked": bool}, ...]
    }
    返回: loss 标量
    """
    t0 = time.perf_counter()
    model.train()

    user_t = torch.tensor(impression_log["user_emb"], dtype=torch.float32).unsqueeze(0)
    items = impression_log["items"]
    clicked = [it for it in items if it.get("clicked")]
    skipped = [it for it in items if not it.get("clicked")]

    if not items:
        return 0.0

    loss = _bpr_loss(model, user_t, clicked, skipped)

    optimizer.zero_grad()
    loss.backward()
    grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), MAX_GRAD_NORM)
    optimizer.step()

    step = train_step._step = getattr(train_step, "_step", 0) + 1
    elapsed = (time.perf_counter() - t0) * 1000
    logger.info(
        f'[train] step={step} 物品={len(items)} 点击={len(clicked)} 跳过={len(skipped)} '
        f'loss={loss.item():.6f} grad_norm={grad_norm:.4f} 耗时={elapsed:.1f}ms'
    )
    return loss.item()


train_step._step = 0


def append_log(entry: dict):
    entry["_ts"] = time.time()
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
