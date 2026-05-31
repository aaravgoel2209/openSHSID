"""
Flask 服务 — 排序 + 强化学习训练
"""
import json
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
from train import load_model, save_model, rank, train_step, append_log

app = Flask(__name__)
CORS(app)  # 允许前端跨域请求
model = load_model()
optimizer = None
step_count = 0


def get_optimizer():
    global optimizer
    if optimizer is None:
        optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    return optimizer


@app.route("/")
def index():
    return {"status": "ok", "service": "model"}


@app.route("/rank", methods=["POST"])
def rank_endpoint():
    data = request.get_json()
    item_embs = data["item_embs"]
    user_emb = data["user_emb"]
    heats = data.get("heats", [2.0] * len(item_embs))
    indices, scores = rank(model, item_embs, user_emb, heats)
    print(f"[Rank] {len(item_embs)} items → top: idx={indices[0]} score={scores[0]:.4f}")
    return jsonify({"indices": indices, "scores": scores})


@app.route("/click", methods=["POST"])
def click_endpoint():
    global step_count
    data = request.get_json()
    impression_log = {
        "user_emb": data["user_emb"],
        "items": data["items"],
    }
    loss = train_step(model, get_optimizer(), impression_log)
    append_log({"type": "impression", "data": data})
    save_model(model)
    step_count += 1
    n = len(data["items"])
    clicked = sum(1 for i in data["items"] if i.get("clicked"))
    print(f"[Train] step={step_count} items={n} clicked={clicked} loss={loss:.6f}")
    return jsonify({"loss": round(loss, 6), "trained": True, "step": step_count})


if __name__ == "__main__":
    from config import PUSH_MODE
    print(f"[Flask] 模型服务启动于 :5000  mode={PUSH_MODE}")
    app.run(port=5000, debug=False)
