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


def _load_system_prompt():
    from pathlib import Path
    sp_path = Path(__file__).parent / 'SYSTEM.md'
    try:
        return sp_path.read_text(encoding='utf-8').strip()
    except Exception as e:
        logger.warning(f'[Rei] 读取 SYSTEM.md 失败: {e}，使用默认 prompt')
        return '你是一个名字叫Rei的校园助手，用简洁直白的回答回复。'


def _generate_rei_reply(question_title, question_content, trigger_content, session_id='default'):
    from tools import TOOLS, handle_tool_call
    from database import save_message, load_recent_messages

    logger.info('[Rei] 开始生成回答')

    try:
        logger.info('[Rei] 创建 API 客户端...')
        client, model_name = _get_rei_client()
        logger.info(f'[Rei] 使用模型: {model_name}')

        # 构建用户消息
        user_content = (
            f'问题标题：{question_title}\n'
            f'问题内容：{question_content}\n\n'
            f'用户的追问/评论：{trigger_content}'
        )

        # 存用户消息
        save_message(session_id, 'user', user_content)

        # 加载最近 20 条历史
        history = load_recent_messages(session_id, limit=20)
        system_prompt = _load_system_prompt()
        messages = [{'role': 'system', 'content': system_prompt}] + history

        logger.info(f'[Rei] 开始生成... (session={session_id}, history={len(history)}条)')
        import time
        t0 = time.perf_counter()

        kwargs = dict(
            model=model_name,
            messages=messages,
            max_tokens=262144,
            temperature=0.7,
        )
        if TOOLS:
            kwargs['tools'] = TOOLS
            kwargs['tool_choice'] = 'auto'

        resp = client.chat.completions.create(**kwargs)
        elapsed = time.perf_counter() - t0

        choice = resp.choices[0]
        msg = choice.message if hasattr(choice, 'message') and choice.message else None

        # 循环处理 tool call，直到模型不再调用 tool
        tool_trace = []
        max_tool_rounds = 10
        tool_round = 0
        while msg and getattr(msg, 'tool_calls', None) and tool_round < max_tool_rounds:
            tool_round += 1
            for tc in msg.tool_calls:
                logger.info(f'[Rei] Tool call #{tool_round}: {tc.function.name}')
                args = json.loads(tc.function.arguments)
                result = handle_tool_call(tc.function.name, args)
                tool_trace.append(f'[Tool] {tc.function.name}({json.dumps(args, ensure_ascii=False)}) → {result[:200]}')
                messages.append({'role': 'tool', 'tool_call_id': tc.id, 'content': result})

            logger.info(f'[Rei] Tool 结果已送回，等待模型最终回答 (round={tool_round})')
            t1 = time.perf_counter()
            kwargs['messages'] = messages
            resp = client.chat.completions.create(**kwargs)
            elapsed = time.perf_counter() - t1
            choice = resp.choices[0]
            msg = choice.message if hasattr(choice, 'message') and choice.message else None

        reply_text = ''
        if msg:
            content = (msg.content or '').strip()
            reasoning = (getattr(msg, 'reasoning_content', None) or '').strip()

            parts = []

            # tool 调用记录 — 灰色小字
            if tool_trace:
                trace_html = '<br>'.join(
                    f'<span style="color:#888;font-size:0.85em">→ {t}</span>'
                    for t in tool_trace
                )
                parts.append(f'<div style="margin:4px 0">{trace_html}</div>')

            # 思考过程（灰色）
            if reasoning:
                parts.append(f'<div style="color:#999;font-size:0.9em;border-left:3px solid #ccc;padding-left:8px;margin:4px 0">{reasoning}</div>')

            # 最终回答
            if content:
                parts.append(content)
            elif reasoning:
                pass
            elif tool_trace:
                parts.append('（模型已回答）')
            else:
                parts.append('（模型未返回有效回答）')

            reply_text = '\n\n'.join(parts)
        elif hasattr(choice, 'text'):
            reply_text = (choice.text or '').strip()
        else:
            reply_text = str(choice)
        if not reply_text:
            logger.warning(f'[Rei] 响应内容为空')
            reply_text = '（模型未返回有效回答）'
        usage = resp.usage or {}
        token_count = getattr(usage, 'completion_tokens', 0) or len(reply_text.split()) if reply_text else 0
        tps = token_count / elapsed if elapsed > 0 else 0
        logger.info(f'[Rei] 生成完成: {token_count} tokens, {elapsed:.1f}s, {tps:.1f} t/s')

        logger.info(f'[Rei] 生成成功，长度: {len(reply_text)} 字符')
        logger.debug(f'[Rei] 回答内容: {reply_text[:100]}...')

        # 存助手的回答
        save_message(session_id, 'assistant', reply_text)

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
        session_id = data.get("session_id", request.remote_addr or 'default')

        logger.info(f'[Rei] 接收生成请求 (session={session_id})')
        logger.debug(f'[Rei] 问题标题: {question_title}')
        reply = _generate_rei_reply(question_title, question_content, trigger_content, session_id)
        logger.info('[Rei] 返回回答')
        return jsonify({"reply": reply})
    except Exception as e:
        logger.error(f'[Rei] 端点处理失败: {e}', exc_info=True)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    from config import PUSH_MODE
    logger.info(f'[Flask] 模型服务启动于 :5000  mode={PUSH_MODE}')
    app.run(port=5000, debug=True)
