"""
Flask 服务 — 排序 + 强化学习训练 + AI 回答生成
"""
import json
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


def _get_rei_model():
    if 'model' not in _rei_model_cache:
        from pathlib import Path
        from llama_cpp import Llama
        gguf_path = Path(__file__).parent / 'model.gguf'
        logger.info(f'[Rei] 加载 GGUF 模型: {gguf_path}')
        try:
            if not gguf_path.exists():
                logger.error(f'[Rei] 模型文件不存在: {gguf_path}')
                raise FileNotFoundError(f'模型文件不存在: {gguf_path}')
            rei_model = Llama(
                model_path=str(gguf_path),
                n_ctx=262144,
                n_threads=4,
                verbose=False,
            )
            _rei_model_cache['model'] = rei_model
            logger.info('[Rei] GGUF 模型加载成功，已缓存到内存')
        except Exception as e:
            logger.error(f'[Rei] 模型加载失败: {e}', exc_info=True)
            raise
    return _rei_model_cache['model']


def _generate_rei_reply(question_title, question_content, trigger_content):
    logger.info('[Rei] 开始生成回答')

    try:
        logger.info('[Rei] 加载模型...')
        rei_model = _get_rei_model()
        logger.info('[Rei] 模型加载完成')

        prompt = (
            f'问题标题：{question_title}\n'
            f'问题内容：{question_content}\n\n'
            f'用户的追问/评论：{trigger_content}\n\n'
            f'请给出简洁有用的回答。思考的时间短一点'
        )

        logger.info('[Rei] 开始生成...')
        output = rei_model(
            prompt,
            max_tokens=262144,
            temperature=0.7,
            top_p=0.9,
            stop=['</s>', '\n\n\n'],
            echo=False,
        )
        reply_text = output['choices'][0]['text'].strip()

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
