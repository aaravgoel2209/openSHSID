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
        from transformers import AutoTokenizer, AutoModelForCausalLM
        logger.info('[Rei] 加载模型: deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B')
        try:
            model_name = 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B'
            logger.info(f'[Rei] 使用默认 HuggingFace 缓存目录: ~/.cache/huggingface/hub/')
            tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
            rei_model = AutoModelForCausalLM.from_pretrained(
                model_name,
                trust_remote_code=True,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                device_map='auto' if torch.cuda.is_available() else None,
            )
            rei_model.eval()
            _rei_model_cache['tokenizer'] = tokenizer
            _rei_model_cache['model'] = rei_model
            logger.info('[Rei] 模型加载成功，已缓存到内存')
        except Exception as e:
            logger.error(f'[Rei] 模型加载失败: {e}')
            raise
    return _rei_model_cache['tokenizer'], _rei_model_cache['model']


def _generate_rei_reply(question_title, question_content, trigger_content):
    logger.info('[Rei] 开始生成回答')
    logger.debug(f'[Rei] 问题: {question_title}')
    logger.debug(f'[Rei] 触发内容: {trigger_content[:100]}...')

    try:
        tokenizer, rei_model = _get_rei_model()

        messages = [
            {'role': 'user', 'content': f'问题标题：{question_title}\n问题内容：{question_content}\n\n用户的追问/评论：{trigger_content}\n\n请给出简洁有用的回答。'},
        ]
        input_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(input_text, return_tensors='pt')

        if torch.cuda.is_available():
            inputs = {k: v.cuda() for k, v in inputs.items()}
            logger.info('[Rei] 使用 GPU 推理')
        else:
            logger.info('[Rei] 使用 CPU 推理')

        with torch.no_grad():
            outputs = rei_model.generate(
                **inputs,
                max_new_tokens=512,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
            )

        generated = outputs[0][inputs['input_ids'].shape[1]:]
        reply_text = tokenizer.decode(generated, skip_special_tokens=True).strip()
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
    data = request.get_json()
    question_title = data.get("question_title", "")
    question_content = data.get("question_content", "")
    trigger_content = data.get("trigger_content", "")

    logger.info('[Rei] 接收生成请求')
    reply = _generate_rei_reply(question_title, question_content, trigger_content)
    logger.info('[Rei] 返回回答')
    return jsonify({"reply": reply})


if __name__ == "__main__":
    from config import PUSH_MODE
    logger.info(f'[Flask] 模型服务启动于 :5000  mode={PUSH_MODE}')
    app.run(port=5000, debug=False)
