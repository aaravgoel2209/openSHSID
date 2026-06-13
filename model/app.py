"""
Flask 服务 — 排序 + 强化学习训练 + AI 回答生成
"""
import json
import os
import torch
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from train import load_model, save_model, rank, train_step, append_log, SAVE_INTERVAL

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
model = load_model()
optimizer = None
step_count = 0

_rei_model_cache = {}


def get_optimizer():
    global optimizer
    if optimizer is None:
        optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    return optimizer


def _get_rei_client():
    if 'client' not in _rei_model_cache:
        from openai import OpenAI
        api_base = os.environ.get('REI_API_BASE', 'http://192.168.2.103:8033/v1')
        api_key = os.environ.get('REI_API_KEY', '114514')
        model_name = os.environ.get('REI_MODEL', 'Qwen3.6-35B-A3B-MXFP4_MOE.gguf')
        logger.info(f'[Rei] OpenAI 兼容 API: {api_base} model={model_name}')
        client = OpenAI(base_url=api_base, api_key=api_key)
        _rei_model_cache['client'] = client
        _rei_model_cache['model_name'] = model_name
        logger.info('[Rei] 客户端已创建')
    return _rei_model_cache['client'], _rei_model_cache['model_name']


def _generate_rei_reply(question_title, question_content, trigger_content):
    logger.info('[Rei] 开始生成回答')

    try:
        logger.info('[Rei] 创建 API 客户端...')
        client, model_name = _get_rei_client()
        logger.info(f'[Rei] 使用模型: {model_name}')

        logger.info('[Rei] 开始生成...')
        import time
        t0 = time.perf_counter()
        resp = client.chat.completions.create(
            model=model_name,
            messages=[
                {'role': 'system', 'content': '你是一个的校园助手，用用户对应的语言回复。'},
                {'role': 'user', 'content': (
                    f'问题标题：{question_title}\n'
                    f'问题内容：{question_content}\n\n'
                    f'用户的追问/评论：{trigger_content}'
                )},
            ],
            max_tokens=512,
            temperature=0.7,
        )
        elapsed = time.perf_counter() - t0
        choice = resp.choices[0]
        if hasattr(choice, 'message') and choice.message:
            reply_text = choice.message.content or ''
        elif hasattr(choice, 'text'):
            reply_text = choice.text or ''
        else:
            reply_text = str(choice)
        reply_text = reply_text.strip()
        if not reply_text:
            logger.warning(f'[Rei] 响应内容为空，尝试解析原始响应: type={type(resp).__name__}')
            logger.warning(f'[Rei] choices[0] 字段: {dir(choice)}')
            reply_text = '（模型未返回有效回答）'
        usage = resp.usage or {}
        token_count = getattr(usage, 'completion_tokens', 0) or len(reply_text.split()) if reply_text else 0
        tps = token_count / elapsed if elapsed > 0 else 0
        logger.info(f'[Rei] 生成完成: {token_count} tokens, {elapsed:.1f}s, {tps:.1f} t/s')

        # 折叠 <think> 推理过程
        import re
        reply_text = re.sub(
            r'<think>(.*?)</think>',
            r'<details><summary>推理过程</summary>\1</details>',
            reply_text,
            flags=re.DOTALL,
        )

        logger.info(f'[Rei] 生成成功，长度: {len(reply_text)} 字符')
        logger.debug(f'[Rei] 回答内容: {reply_text[:100]}...')
        return reply_text
    except Exception as e:
        logger.error(f'[Rei] 生成失败: {e}', exc_info=True)
        return '抱歉，我暂时无法回答这个问题，请稍后再试。'


@app.route("/")
def index():
    return {"status": "ok", "service": "model"}


@app.route("/rank", methods=["POST"])
def rank_endpoint():
    data = request.get_json()
    item_embs = data["item_embs"]
    user_emb = data["user_emb"]
    heats = data.get("heats", [2.0] * len(item_embs))
    logger.info(f'[Rank] 接收请求: {len(item_embs)} 个物品')
    indices, scores = rank(model, item_embs, user_emb, heats)
    logger.info(f'[Rank] 排序完成: 最高分={scores[0]:.4f if scores else 0}')
    return jsonify({"indices": indices, "scores": scores})


@app.route("/click", methods=["POST"])
def click_endpoint():
    global step_count
    data = request.get_json()
    impression_log = {
        "user_emb": data["user_emb"],
        "items": data["items"],
    }
    logger.info(f'[Train] 接收训练数据: {len(data["items"])} 个物品')
    loss = train_step(model, get_optimizer(), impression_log)
    append_log({"type": "impression", "data": data})
    step_count += 1

    if step_count % SAVE_INTERVAL == 0:
        logger.info(f'[Train] 保存模型 (step={step_count})')
        save_model(model)

    n = len(data["items"])
    clicked = sum(1 for i in data["items"] if i.get("clicked"))
    logger.info(f'[Train] 完成: step={step_count} loss={loss:.6f} 点击={clicked}/{n}')
    return jsonify({"loss": round(loss, 6), "trained": True, "step": step_count})


@app.route("/rei/reply", methods=["POST"])
def rei_reply_endpoint():
    try:
        data = request.get_json()
        question_title = data.get("question_title", "")
        question_content = data.get("question_content", "")
        trigger_content = data.get("trigger_content", "")

        logger.info('[Rei] 接收生成请求')
        logger.debug(f'[Rei] 问题标题: {question_title}')
        reply = _generate_rei_reply(question_title, question_content, trigger_content)
        logger.info('[Rei] 返回回答')
        return jsonify({"reply": reply})
    except Exception as e:
        logger.error(f'[Rei] 端点处理失败: {e}', exc_info=True)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    from config import PUSH_MODE
    logger.info(f'[Flask] 模型服务启动于 :5000  mode={PUSH_MODE}')
    app.run(port=5000, debug=True)
