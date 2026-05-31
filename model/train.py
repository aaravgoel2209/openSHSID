"""
REINFORCE 强化学习 — 通过点击率反馈训练排序模型
"""
import json
import time
import random
from pathlib import Path
import torch
import torch.nn.functional as F
from model import Model

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
MODEL_PATH = DATA_DIR / "model.pt"
LOG_PATH = DATA_DIR / "log.jsonl"


def load_model():
    m = Model()
    if MODEL_PATH.exists():
        state = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
        m.load_state_dict(state)
        n = sum(p.numel() for p in m.parameters())
        print(f"[load] 从 {MODEL_PATH} 加载模型 ({n:,} 参数)")
    else:
        print(f"[load] 未找到已有模型，使用随机初始化")
    return m


def save_model(m):
    torch.save(m.state_dict(), MODEL_PATH)
    size_kb = MODEL_PATH.stat().st_size / 1024
    print(f"[save] 模型已保存 → {MODEL_PATH} ({size_kb:.1f} KB)")


def rank(model, item_embs, user_emb, heats):
    """
    item_embs: list of list[float] — 每篇文章的 32-dim 向量
    user_emb: list[float] — 当前用户的 32-dim 向量
    heats: list[float] — 每篇文章的热度
    返回: list[int] — 文章索引的排序（得分从高到低）
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
                item_t = torch.tensor(emb, dtype=torch.float32) * h
                s = model(item_t.unsqueeze(0), user_t).item()
                scores.append((i, s))
        mode_label = "model"
    else:
        # algorithm mode
        for i, (emb, h) in enumerate(zip(item_embs, heats)):
            s = score_item(emb, user_emb, h)
            scores.append((i, s))
        mode_label = "algorithm"

    scores.sort(key=lambda x: x[1], reverse=True)
    ordered = [idx for idx, _ in scores]
    vals = [s for _, s in scores]
    elapsed = (time.perf_counter() - t0) * 1000

    print(f"[rank] mode={mode_label} 物品={n_items} 耗时={elapsed:.1f}ms "
          f"最高分={vals[0]:.4f} 最低分={vals[-1]:.4f} "
          f"均值={sum(vals)/len(vals):.4f}")
    return ordered, vals


def train_step(model, optimizer, impression_log):
    """
    impression_log: {
        "user_emb": [...],
        "items": [{"idx": 0, "emb": [...], "heat": 2.3, "clicked": True}, ...]
    }
    """
    t0 = time.perf_counter()
    model.train()

    user_t = torch.tensor(impression_log["user_emb"], dtype=torch.float32)
    n_items = len(impression_log["items"])

    log_probs = []
    rewards = []
    raw_scores = []

    for item in impression_log["items"]:
        item_t = torch.tensor(item["emb"], dtype=torch.float32) * item["heat"]
        score = model(item_t.unsqueeze(0), user_t.unsqueeze(0)).squeeze(0)
        log_prob = F.logsigmoid(score)
        reward = 1.0 if item["clicked"] else -0.2
        log_probs.append(log_prob)
        rewards.append(reward)
        raw_scores.append(score.item())

    if not log_probs:
        return 0.0

    log_probs_t = torch.stack(log_probs)
    rewards_t = torch.tensor(rewards, dtype=torch.float32)

    loss = - (log_probs_t * rewards_t).mean()

    optimizer.zero_grad()
    loss.backward()

    # 梯度统计
    total_grad = 0.0
    n_params = 0
    for p in model.parameters():
        if p.grad is not None:
            total_grad += p.grad.abs().sum().item()
            n_params += p.numel()
    avg_grad = total_grad / n_params if n_params else 0

    optimizer.step()

    n_clicked = sum(1 for r in rewards if r > 0)
    elapsed = (time.perf_counter() - t0) * 1000

    print(f"[train] step={getattr(train_step, '_step', 0) + 1} "
          f"物品={n_items} 点击={n_clicked} "
          f"loss={loss.item():.6f} "
          f"得分范围=[{min(raw_scores):.4f}, {max(raw_scores):.4f}] "
          f"avg_grad={avg_grad:.6f} "
          f"耗时={elapsed:.1f}ms")
    train_step._step = getattr(train_step, '_step', 0) + 1

    return loss.item()


train_step._step = 0


def append_log(entry):
    entry["_ts"] = time.time()
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    print(f"[log] 已写入 {LOG_PATH}")
