"""
Flask 服务 — 排序 + 强化学习训练 + AI 回答生成
"""
import json
import os
import torch


import logging
from datetime import datetime
from flask import Flask, request, jsonify, Response, stream_with_context
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
        api_base = os.environ.get('REI_API_BASE', 'http://factory.zengyuxiang.cn/v1')
        api_key = os.environ.get('REI_API_KEY', '114514')
        model_name = os.environ.get('REI_MODEL', 'Qwen3.6-35B-A3B-MXFP4_MOE.gguf')
        logger.info(f'[Rei] OpenAI 兼容 API: {api_base} model={model_name}')
        # 直连 LAN 模型服务：绕过系统代理（HTTP_PROXY 会劫持导致超时）；
        # 流式生成读超时放宽（token 间隔），连接超时较短
        import httpx
        http_client = httpx.Client(
            trust_env=False,
            timeout=httpx.Timeout(connect=10.0, read=120.0, write=10.0, pool=10.0),
        )
        client = OpenAI(base_url=api_base, api_key=api_key, max_retries=0, http_client=http_client)
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


def _build_rei_messages(question_title, question_content, trigger_content, session_id, question_id, image=None):
    """构建发给模型的消息列表（system + RAG + 当前问答帖 + 历史），并记录本轮用户消息。
    image 为 base64 data URL 时，把本轮用户消息转成多模态（文本+图片）内容。"""
    from database import save_message, load_recent_messages

    # 问答场景带题目上下文；纯聊天（无题目）直接存用户消息，历史更干净
    if question_title or question_content:
        user_content = (
            f'问题标题：{question_title}\n'
            f'问题内容：{question_content}\n\n'
            f'用户的追问/评论：{trigger_content}'
        )
    else:
        user_content = trigger_content
    # 记录上下文：本轮用户消息入库（只存文本，图片不落库以免历史膨胀）
    save_message(session_id, 'user', user_content + ('\n[图片]' if image else ''))

    history = load_recent_messages(session_id, limit=20)
    system_prompt = _load_system_prompt()
    messages = [{'role': 'system', 'content': system_prompt}] + history

    # RAG: 从记忆库/知识库/问答语义检索相关内容并注入上下文
    try:
        import rag
        query = ' '.join(p for p in (question_title, trigger_content) if p).strip() or question_content
        hits = rag.retrieve(query)
        ctx = rag.format_context(hits)
        if ctx:
            logger.info(f'[RAG] 注入 {len(hits)} 条相关内容 (query="{query[:40]}")')
            messages.insert(1, {'role': 'system', 'content': ctx})
        else:
            logger.info('[RAG] 无相关内容命中')
    except Exception as e:
        logger.error(f'[RAG] 检索失败，跳过注入: {e}')

    # 注入当前问答帖的完整内容（问题 + 全部回答），让 Rei 看到整个上下文
    if question_id:
        try:
            from tools import qa_read
            thread = qa_read(question_id)
            if thread and not thread.startswith('读取失败'):
                logger.info(f'[Rei] 注入完整问答帖 (question_id={question_id})')
                messages.insert(1, {
                    'role': 'system',
                    'content': f'你正在以下问答帖中回复，这是该帖的完整内容（问题与已有回答）：\n{thread}'
                })
        except Exception as e:
            logger.error(f'[Rei] 注入问答帖失败: {e}')

    # 多模态：把图片附到本轮用户消息（OpenAI vision 格式，llama.cpp + mmproj 支持）
    if image:
        for m in reversed(messages):
            if m.get('role') == 'user':
                m['content'] = [
                    {'type': 'text', 'text': user_content},
                    {'type': 'image_url', 'image_url': {'url': image}},
                ]
                break

    return messages, len(history)


def _rei_stream_core(question_title, question_content, trigger_content, session_id='default', question_id=None, image=None):
    """生成 Rei 回答的流式核心。逐步 yield 事件 dict：
        {'type': 'reasoning'|'content'|'tool', 'text': ...}  → 增量
        {'type': 'done', 'text': <完整回答>}                 → 结束（已存入历史）
        {'type': 'error', 'text': <错误信息>}
    在 tool-call 轮次中处理工具，最终回答以流式产出。被阻塞式和 SSE 两个端点共用。"""
    from tools import TOOLS, handle_tool_call
    from database import save_message
    import time

    try:
        client, model_name = _get_rei_client()
        messages, hist_n = _build_rei_messages(
            question_title, question_content, trigger_content, session_id, question_id, image
        )
        logger.info(f'[Rei] 开始流式生成... (session={session_id}, history={hist_n}条)')

        kwargs = dict(model=model_name, messages=messages, max_tokens=262144, temperature=0.7, stream=True)
        if TOOLS:
            kwargs['tools'] = TOOLS
            kwargs['tool_choice'] = 'auto'

        max_rounds = 10
        final_content = ''
        for round_i in range(max_rounds):
            t0 = time.perf_counter()
            stream = client.chat.completions.create(**kwargs)

            content_parts = []
            tool_calls = {}  # index -> {id, name, args}
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                reasoning = getattr(delta, 'reasoning_content', None)
                if reasoning:
                    yield {'type': 'reasoning', 'text': reasoning}
                if getattr(delta, 'content', None):
                    content_parts.append(delta.content)
                    yield {'type': 'content', 'text': delta.content}
                for tc in (getattr(delta, 'tool_calls', None) or []):
                    slot = tool_calls.setdefault(tc.index, {'id': '', 'name': '', 'args': ''})
                    if tc.id:
                        slot['id'] = tc.id
                    if tc.function and tc.function.name:
                        slot['name'] = tc.function.name
                    if tc.function and tc.function.arguments:
                        slot['args'] += tc.function.arguments

            # 有工具调用 → 执行并回灌，进入下一轮
            if tool_calls:
                ordered = [tool_calls[i] for i in sorted(tool_calls)]
                messages.append({
                    'role': 'assistant',
                    'content': ''.join(content_parts) or None,
                    'tool_calls': [
                        {'id': s['id'], 'type': 'function',
                         'function': {'name': s['name'], 'arguments': s['args']}}
                        for s in ordered
                    ],
                })
                for s in ordered:
                    try:
                        args = json.loads(s['args'] or '{}')
                    except json.JSONDecodeError:
                        args = {}
                    logger.info(f'[Rei] Tool call #{round_i + 1}: {s["name"]}')
                    result = handle_tool_call(s['name'], args)
                    yield {'type': 'tool',
                           'text': f'{s["name"]}({json.dumps(args, ensure_ascii=False)}) → {result[:200]}'}
                    messages.append({'role': 'tool', 'tool_call_id': s['id'], 'content': result})
                kwargs['messages'] = messages
                continue

            # 无工具调用 → 本轮即最终回答
            final_content = ''.join(content_parts).strip()
            elapsed = time.perf_counter() - t0
            logger.info(f'[Rei] 流式生成完成: {len(final_content)} 字符, {elapsed:.1f}s')
            break
        else:
            logger.warning('[Rei] 达到最大工具轮次仍未产出最终回答')

        # 记录上下文：助手回答入库（存纯文本，作为后续对话记忆）
        save_message(session_id, 'assistant', final_content or '（模型未返回有效回答）')
        yield {'type': 'done', 'text': final_content}
    except Exception as e:
        logger.error(f'[Rei] 流式生成失败: {e}', exc_info=True)
        yield {'type': 'error', 'text': str(e)}


def _generate_rei_reply(question_title, question_content, trigger_content, session_id='default', question_id=None):
    """阻塞式：消费流式核心，拼成带工具记录/思考过程的 HTML 回答（供 @Rei 自动回答流程）。"""
    tool_trace, reasoning_parts, content_parts = [], [], []
    errored = False
    for ev in _rei_stream_core(question_title, question_content, trigger_content, session_id, question_id):
        t = ev['type']
        if t == 'tool':
            tool_trace.append(ev['text'])
        elif t == 'reasoning':
            reasoning_parts.append(ev['text'])
        elif t == 'content':
            content_parts.append(ev['text'])
        elif t == 'error':
            errored = True

    if errored and not content_parts:
        return '抱歉，我暂时无法回答这个问题，请稍后再试。'

    content = ''.join(content_parts).strip()
    reasoning = ''.join(reasoning_parts).strip()
    parts = []
    if tool_trace:
        trace_html = '<br>'.join(
            f'<span style="color:#888;font-size:0.85em">→ {t}</span>' for t in tool_trace
        )
        parts.append(f'<div style="margin:4px 0">{trace_html}</div>')
    if reasoning:
        parts.append(f'<div style="color:#999;font-size:0.9em;border-left:3px solid #ccc;padding-left:8px;margin:4px 0">{reasoning}</div>')
    if content:
        parts.append(content)
    elif not reasoning:
        parts.append('（模型已回答）' if tool_trace else '（模型未返回有效回答）')

    return '\n\n'.join(parts) if parts else '（模型未返回有效回答）'


import re

_THINK_RE = re.compile(r'<think>.*?</think>', re.DOTALL)


def _detect_lang(text):
    """粗略判断主体语言：含较多中日韩统一表意文字则视为中文，否则英文。"""
    cjk = sum(1 for ch in text if '一' <= ch <= '鿿')
    letters = sum(1 for ch in text if ch.isascii() and ch.isalpha())
    return 'zh' if cjk >= letters else 'en'


def _translate_text(text, target=None):
    """调用 AI 模型在中英之间翻译。
    target 为 'zh'/'en' 时翻译到指定语言；为空时自动取与源语言相反的一方。
    返回 (译文, 源语言, 目标语言)。"""
    client, model_name = _get_rei_client()
    src = _detect_lang(text)
    if target not in ('zh', 'en'):
        target = 'en' if src == 'zh' else 'zh'
    target_name = '简体中文' if target == 'zh' else 'English'
    system_prompt = (
        f'You are a professional translator. Translate the user-provided text into {target_name}, '
        f'preserving meaning, tone and formatting. Output ONLY the translated text — '
        f'no explanations, no quotes, no language labels, no extra commentary.'
    )
    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': text},
    ]
    max_tokens = max(512, min(8192, len(text) * 4))
    logger.info(f'[Translate] {src} → {target} ({len(text)} 字符)')
    resp = client.chat.completions.create(
        model=model_name,
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.3,
        stream=False,
    )
    content = (resp.choices[0].message.content or '').strip()
    # 思考型模型可能把推理放进 <think>…</think>，去除后只留译文
    content = _THINK_RE.sub('', content).strip()
    return content, src, target


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


@app.route("/translate", methods=["POST"])
def translate_endpoint():
    """中英互译。请求体：{"text": "...", "target": "zh"|"en"|null}
    target 省略/为空时自动检测源语言并翻到另一种语言。
    返回：{"translation": "...", "source_lang": "zh"|"en", "target_lang": "zh"|"en"}"""
    try:
        data = request.get_json() or {}
        text = (data.get("text") or "").strip()
        target = data.get("target") or None
        if not text:
            return jsonify({"error": "text 不能为空"}), 400
        if target not in (None, 'zh', 'en'):
            return jsonify({"error": "target 只能为 'zh' 或 'en'"}), 400

        translation, src, tgt = _translate_text(text, target)
        return jsonify({"translation": translation, "source_lang": src, "target_lang": tgt})
    except Exception as e:
        logger.error(f'[Translate] 端点处理失败: {e}', exc_info=True)
        return jsonify({"error": str(e)}), 500


def _summarize_text(text, instruction=''):
    """调用主聊天模型对（可能来自 OCR 的）文本做中文摘要，返回纯摘要文本。"""
    client, model_name = _get_rei_client()
    system_prompt = (
        '你是一个文档摘要助手。请阅读用户提供的文本（可能是 OCR 提取、含少量噪声与排版符号），'
        '生成条理清晰的中文摘要：先一句话总述，再用要点列出关键信息。'
        '忽略明显的 OCR 噪声与坐标/标记符号，只输出摘要本身，不要额外说明。'
    )
    user_content = (f'{instruction}\n\n' if instruction else '') + text
    max_tokens = max(512, min(8192, len(text)))
    logger.info(f'[Summarize] 摘要 {len(text)} 字符')
    resp = client.chat.completions.create(
        model=model_name,
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content},
        ],
        max_tokens=max_tokens,
        temperature=0.3,
        stream=False,
    )
    content = (resp.choices[0].message.content or '').strip()
    return _THINK_RE.sub('', content).strip()


@app.route("/summarize", methods=["POST"])
def summarize_endpoint():
    """文本摘要。请求体：{"text": "...", "instruction": "可选的额外要求"}
    返回：{"summary": "..."}。主聊天模型不可用时返回 500（调用方可优雅降级）。"""
    try:
        data = request.get_json() or {}
        text = (data.get("text") or "").strip()
        instruction = (data.get("instruction") or "").strip()
        if not text:
            return jsonify({"error": "text 不能为空"}), 400
        summary = _summarize_text(text, instruction)
        return jsonify({"summary": summary})
    except Exception as e:
        logger.error(f'[Summarize] 端点处理失败: {e}', exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/rei/reply", methods=["POST"])
def rei_reply_endpoint():
    try:
        data = request.get_json()
        question_title = data.get("question_title", "")
        question_content = data.get("question_content", "")
        trigger_content = data.get("trigger_content", "")
        session_id = data.get("session_id", request.remote_addr or 'default')
        question_id = data.get("question_id")

        logger.info(f'[Rei] 接收生成请求 (session={session_id}, question_id={question_id})')
        logger.debug(f'[Rei] 问题标题: {question_title}')
        reply = _generate_rei_reply(question_title, question_content, trigger_content, session_id, question_id)
        logger.info('[Rei] 返回回答')
        return jsonify({"reply": reply})
    except Exception as e:
        logger.error(f'[Rei] 端点处理失败: {e}', exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/rei/history", methods=["GET"])
def rei_history_endpoint():
    """返回某会话已存储的对话历史（用于前端恢复用户的 AI 聊天记录）。"""
    session_id = request.args.get("session_id", "")
    if not session_id:
        return jsonify({"messages": []})
    from database import load_recent_messages
    msgs = load_recent_messages(session_id, limit=200)
    return jsonify({"messages": msgs})


@app.route("/rei/stream", methods=["POST"])
def rei_stream_endpoint():
    """SSE 流式回答：逐 token 推送。前端用 EventSource/fetch 读取 text/event-stream。
    事件格式：data: {"type": "content"|"reasoning"|"tool"|"done"|"error", "text": ...}\\n\\n
    结束以 data: [DONE] 标记。"""
    data = request.get_json() or {}
    question_title = data.get("question_title", "")
    question_content = data.get("question_content", "")
    trigger_content = data.get("trigger_content", "")
    session_id = data.get("session_id", request.remote_addr or 'default')
    question_id = data.get("question_id")
    image = data.get("image")  # base64 data URL（可选）
    logger.info(f'[Rei] 接收流式请求 (session={session_id}, question_id={question_id}, image={bool(image)})')

    def sse():
        try:
            for ev in _rei_stream_core(question_title, question_content, trigger_content, session_id, question_id, image):
                yield f'data: {json.dumps(ev, ensure_ascii=False)}\n\n'
        except Exception as e:
            logger.error(f'[Rei] 流式端点异常: {e}', exc_info=True)
            yield f'data: {json.dumps({"type": "error", "text": str(e)}, ensure_ascii=False)}\n\n'
        yield 'data: [DONE]\n\n'

    return Response(
        stream_with_context(sse()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


if __name__ == "__main__":
    from config import PUSH_MODE
    # 0.0.0.0：允许部署机之外的客户端（如打包后的 Electron 应用）连接。
    # debug 默认关闭——Werkzeug 的交互式调试器在暴露给公网时等同于远程代码执行，
    # 且当前接口均无鉴权；本地调试需要时显式设 REI_FLASK_DEBUG=1。
    host = os.environ.get('REI_FLASK_HOST', '0.0.0.0')
    debug_mode = os.environ.get('REI_FLASK_DEBUG', '0') == '1'
    logger.info(f'[Flask] 模型服务启动于 {host}:5000  mode={PUSH_MODE}  debug={debug_mode}')
    # 为已有记忆补齐向量 + 同步知识库/问答（best-effort，服务不可用时跳过）
    try:
        import rag
        rag.backfill_embeddings()
        rag.sync_all(force=True)
    except Exception as e:
        logger.warning(f'[RAG] 启动初始化跳过: {e}')
    app.run(host=host, port=5000, debug=debug_mode)
