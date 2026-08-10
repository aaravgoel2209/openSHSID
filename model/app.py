"""
Flask 服务 — 排序 + 强化学习训练 + AI 回答生成
"""
import json
import torch

from config_loader import cfg

LLM = cfg['llm']
SECRETS = cfg['secrets']
RECO_CFG = cfg['reco_model']


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
        optimizer = torch.optim.Adam(model.parameters(), lr=RECO_CFG['optimizer_lr'])
    return optimizer


def _get_rei_client():
    if 'client' not in _rei_model_cache:
        from openai import OpenAI
        api_base = LLM['api_base']
        api_key = SECRETS['rei_api_key']
        model_name = LLM['model_name']
        logger.info(f'[Rei] OpenAI 兼容 API: {api_base} model={model_name}')
        # 直连 LAN 模型服务：绕过系统代理（HTTP_PROXY 会劫持导致超时）；
        # 流式生成读超时放宽（token 间隔），连接超时较短
        import httpx
        to = LLM['http_timeout']
        http_client = httpx.Client(
            trust_env=False,
            timeout=httpx.Timeout(connect=to['connect'], read=to['read'], write=to['write'], pool=to['pool']),
        )
        client = OpenAI(base_url=api_base, api_key=api_key, max_retries=LLM['max_retries'], http_client=http_client)
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


_SUMMARY_SYS = (
    '你是对话记忆维护器。下面给你一份【既有摘要】和随后的【新增对话】。'
    '请把两者合并、更新成一份简洁的中文摘要，供助手记住早期对话。'
    '要求：保留关于用户的事实、已确认的信息、待办/未决问题、重要结论；'
    '删除寒暄与冗余；用要点列出；只输出摘要本身，不要额外说明。'
)


def _text_of(content):
    """取消息文本（多模态 list 时拼接文本片段），供折叠摘要使用。"""
    if isinstance(content, list):
        return ' '.join(p.get('text', '') for p in content
                        if isinstance(p, dict) and p.get('type') == 'text')
    return content or ''


def _fold_summary(old_summary, overflow_msgs):
    """把溢出的旧消息（连同既有摘要）折叠成一份新的滚动摘要。失败时抛异常由调用方兜底。"""
    import context_budget
    client, model_name = _get_rei_client()
    convo = '\n'.join(f'{m["role"]}: {_text_of(m["content"])}' for m in overflow_msgs)
    user = f'【既有摘要】\n{old_summary or "（无）"}\n\n【新增对话】\n{convo}'
    resp = client.chat.completions.create(
        model=model_name,
        messages=[{'role': 'system', 'content': _SUMMARY_SYS},
                  {'role': 'user', 'content': user}],
        max_tokens=context_budget.SUMMARY_MAX_TOKENS,
        temperature=LLM['summary_temperature'],
        stream=False,
    )
    content = (resp.choices[0].message.content or '').strip()
    return _THINK_RE.sub('', content).strip()


def maybe_compact(session_id):
    """会话累计上下文达到阈值（默认 100k tokens）时，做一次整段压缩：
    把除最近若干条以外的全部历史折叠进滚动摘要，并物理删除被折叠的原始消息，
    避免原始表无限增长、后续扫描保持廉价。与 Tier 1 的每轮预算互补——后者保证
    单轮 prompt 不溢出，这里保证长期存储有界并周期性重新固化摘要。"""
    import context_budget as cb
    from database import (count_session, load_all_messages,
                          get_session_summary, save_session_summary, delete_messages_upto)
    threshold = LLM['compact_at_tokens']
    keep_recent = LLM['compact_keep_recent']

    n, chars = count_session(session_id)
    if n <= keep_recent:
        return
    # 廉价预检：token 上界 ≈ 1.2·字符 + 4·条数；未触阈值直接返回，不加载正文
    if chars * 1.2 + n * 4 < threshold:
        return
    rows = load_all_messages(session_id)
    if cb.messages_tokens(rows) < threshold:
        return

    to_fold = rows[:-keep_recent]
    if not to_fold:
        return
    summary, _ = get_session_summary(session_id)
    try:
        new_summary = _fold_summary(summary, to_fold)
    except Exception as e:
        logger.error(f'[Rei] 100k 压缩折叠失败，跳过本次: {e}')
        return
    fold_upto = to_fold[-1]['id']
    save_session_summary(session_id, new_summary, fold_upto)
    delete_messages_upto(session_id, fold_upto)
    logger.info(f'[Rei] 触发 100k 压缩：折叠并清理 {len(to_fold)} 条，保留最近 {keep_recent} 条')


_COREF_TOKENS = ('它', '他', '她', '这', '那', '其', '此', '该', '们',
                 'it', 'its', 'that', 'this', 'those', 'these', 'they', 'them')


def _build_rag_query(question_title, question_content, trigger_content, session_id):
    """构造 RAG 检索 query。追问常含指代（“它的截止日期呢”），只用当前句检索会命中垃圾；
    这里把上一条用户消息并入 query 做廉价的指代消解，无需额外模型调用。
    REI_RAG_QUERY_REWRITE=1 时改用模型把多轮对话改写成独立问题（默认关，避免每轮加一次调用）。"""
    from database import load_recent_messages
    base = ' '.join(p for p in (question_title, trigger_content) if p).strip() or (question_content or '')

    if LLM['rag_query_rewrite']:
        try:
            rw = _rewrite_query(session_id, base)
            if rw:
                return rw
        except Exception as e:
            logger.error(f'[RAG] query 改写失败，回退: {e}')

    # 廉价路径：短查询或含指代词时，前置上一条用户消息作为上下文
    low = base.lower()
    if len(base) < 12 or any(t in low for t in _COREF_TOKENS):
        try:
            recent = load_recent_messages(session_id, limit=LLM['history_msg_limit'])
            prev_users = [m['content'] for m in recent[:-1] if m['role'] == 'user']  # 去掉当前这条
            if prev_users:
                return f'{prev_users[-1][:LLM["history_text_truncate"]]} {base}'.strip()
        except Exception:
            pass
    return base


def _rewrite_query(session_id, base):
    """用模型把最近几轮对话 + 当前问题改写成一个可独立检索的问题。"""
    from database import load_recent_messages
    recent = load_recent_messages(session_id, limit=LLM['history_msg_limit'])
    convo = '\n'.join(f'{m["role"]}: {_text_of(m["content"])[:LLM["history_text_truncate"]]}' for m in recent[-5:])
    client, model_name = _get_rei_client()
    resp = client.chat.completions.create(
        model=model_name,
        messages=[
            {'role': 'system', 'content':
                '把下面的多轮对话与最后的问题，改写成一个语义完整、可独立用于检索的中文问题（消解指代）。'
                '只输出改写后的问题，不要解释。'},
            {'role': 'user', 'content': f'对话：\n{convo}\n\n当前问题：{base}'},
        ],
        max_tokens=LLM['rewrite_max_tokens'], temperature=LLM['rewrite_temperature'], stream=False,
    )
    return _THINK_RE.sub('', (resp.choices[0].message.content or '')).strip()


def _build_rei_messages(question_title, question_content, trigger_content, session_id, question_id, image=None):
    """构建发给模型的消息列表并记录本轮用户消息。

    按 token 预算装配（见 context_budget）：system 提示词、RAG、问答帖、滚动摘要为
    高优先级先占预算，历史从最新往回填、丢最旧的；被丢的旧消息折叠进滚动摘要。
    image 为 base64 data URL 时，把本轮用户消息转成多模态（文本+图片）内容。
    """
    import context_budget as cb
    from database import (save_message, load_messages_after,
                          get_session_summary, save_session_summary)

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

    # 100k 自动压缩：累计上下文过大时，折叠旧消息进摘要并清理原始行（在装配前先跑）
    try:
        maybe_compact(session_id)
    except Exception as e:
        logger.error(f'[Rei] 压缩检查异常，跳过: {e}')

    system_prompt = _load_system_prompt()

    # ── 高优先级 head：system + RAG + 问答帖（顺序即最终顺序，摘要稍后插在 system 之后）──
    head = [{'role': 'system', 'content': system_prompt}]

    # RAG: 从记忆库/知识库/问答语义检索相关内容并注入上下文
    sources = []
    try:
        import rag
        query = _build_rag_query(question_title, question_content, trigger_content, session_id)
        hits = rag.retrieve(query)
        ctx = rag.format_context(hits)
        if ctx:
            logger.info(f'[RAG] 注入 {len(hits)} 条相关内容 (query="{query[:40]}")')
            head.append({'role': 'system', 'content': ctx})
            # 供前端展示「参考来源」，也让用户能核实 AI 依据（学校场景信任度很重要）
            sources = [{'source': it.get('source', ''), 'id': it.get('id'),
                        'title': it.get('title', ''), 'score': round(float(s), 3)}
                       for it, s in hits]
        else:
            logger.info('[RAG] 无相关内容命中')
    except Exception as e:
        logger.error(f'[RAG] 检索失败，跳过注入: {e}')

    # 注入当前问答帖的完整内容（问题 + 全部回答）；超长帖按 token 上限截断，避免挤掉 system/历史
    if question_id:
        try:
            from tools import qa_read
            thread = qa_read(question_id)
            if thread and not thread.startswith('读取失败'):
                # 保留两端：开头是问题+早期回答，末尾是触发回复的最新回答，
                # 只折叠中间——否则超长帖会把 Rei 正在回复的那条切掉
                thread = cb.truncate_preserve_edges(thread, cb.QA_MAX_TOKENS)
                logger.info(f'[Rei] 注入完整问答帖 (question_id={question_id})')
                head.append({
                    'role': 'system',
                    'content': f'你正在以下问答帖中回复，这是该帖的完整内容（问题与已有回答）：\n{thread}'
                })
        except Exception as e:
            logger.error(f'[Rei] 注入问答帖失败: {e}')

    # ── 滚动摘要 + 历史按预算装配 ──
    summary, last_id = get_session_summary(session_id)
    history = load_messages_after(session_id, after_id=last_id)  # 未被摘要覆盖的消息（含本轮）

    # head token = system/RAG/问答帖 + 固定预留的摘要槽（无论当前有无摘要都预留，预算才稳定）
    head_tokens = cb.messages_tokens(head) + cb.SUMMARY_RESERVE
    budget = cb.history_budget(head_tokens)
    kept, overflow = cb.fit_history(history, budget)

    # 有消息被挤出 → 折叠进滚动摘要（每跨越一次窗口边界才发生，不是每轮都摘要）
    if len(overflow) >= 2:
        try:
            summary = _fold_summary(summary, overflow)
            save_session_summary(session_id, summary, overflow[-1]['id'])
            logger.info(f'[Rei] 滚动摘要已更新: 折叠 {len(overflow)} 条 (last_id={overflow[-1]["id"]})')
        except Exception as e:
            # 摘要失败：本轮仍丢弃溢出（保证不溢出），但不推进 last_id，下轮重试
            logger.error(f'[Rei] 折叠摘要失败，本轮丢弃溢出未入摘要: {e}')

    messages = list(head)
    if summary:
        messages.insert(1, {'role': 'system',
                            'content': f'早期对话的摘要（供参考记忆）：\n{summary}'})
    messages.extend({'role': m['role'], 'content': m['content']} for m in kept)

    # 多模态：把图片附到本轮用户消息（OpenAI vision 格式，llama.cpp + mmproj 支持）
    if image:
        for m in reversed(messages):
            if m.get('role') == 'user':
                m['content'] = [
                    {'type': 'text', 'text': user_content},
                    {'type': 'image_url', 'image_url': {'url': image}},
                ]
                break

    logger.info(f'[Rei] 上下文装配: head≈{cb.messages_tokens(head)}tok, 摘要={bool(summary)}, '
                f'历史 {len(kept)}/{len(history)} 条, 总≈{cb.messages_tokens(messages)}tok/{cb.CTX_WINDOW}')
    return messages, {'kept': len(kept), 'sources': sources}


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
        messages, build_meta = _build_rei_messages(
            question_title, question_content, trigger_content, session_id, question_id, image
        )
        logger.info(f'[Rei] 开始流式生成... (session={session_id}, history={build_meta["kept"]}条)')
        # 先把检索来源下发给前端展示「参考来源」，让用户可核实 AI 依据
        if build_meta.get('sources'):
            yield {'type': 'sources', 'items': build_meta['sources']}

        import context_budget
        kwargs = dict(model=model_name, messages=messages,
                      max_tokens=context_budget.MAX_OUTPUT, temperature=LLM['chat_temperature'], stream=True)
        if TOOLS:
            kwargs['tools'] = TOOLS
            kwargs['tool_choice'] = 'auto'

        max_rounds = LLM['tool_max_rounds']
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

# 数学公式片段：翻译前先抠出来用占位符替换，避免大模型把 LaTeX（\text{} 里的词、
# 命令、$ 定界符）一起“翻译”坏掉导致前端 MathJax 无法解析。顺序很重要：块级在前，行内在后。
_MATH_PATTERNS = [
    re.compile(r'\$\$[\s\S]+?\$\$'),
    re.compile(r'\\\[[\s\S]+?\\\]'),
    re.compile(r'\\\([\s\S]+?\\\)'),
    re.compile(r'\\begin\{[a-zA-Z*]+\}[\s\S]+?\\end\{[a-zA-Z*]+\}'),
    re.compile(r'\$(?!\s)[^\n$]+?(?<!\s)\$'),
]


def _protect_math(text):
    """把公式替换成不会被翻译的占位符，返回 (masked_text, store)。"""
    store = []

    def _sub(m):
        store.append(m.group(0))
        return f'{len(store) - 1}'  # 私有区字符，模型会原样保留

    for pat in _MATH_PATTERNS:
        text = pat.sub(_sub, text)
    return text, store


def _restore_math(text, store):
    """把占位符还原成原始公式。容忍模型在占位符周围加空格。"""
    def _un(m):
        i = int(m.group(1))
        return store[i] if 0 <= i < len(store) else m.group(0)

    return re.sub('\\s*(\\d+)\\s*', _un, text)


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
    # 先把数学公式抠成占位符，避免模型翻译时改坏 LaTeX（导致前端 MathJax 无法渲染）
    masked, math_store = _protect_math(text)
    system_prompt = (
        f'You are a professional translator. Translate the user-provided text into {target_name}, '
        f'preserving meaning, tone and formatting. Output ONLY the translated text — '
        f'no explanations, no quotes, no language labels, no extra commentary. '
        f'The text may contain placeholder markers (private-use characters wrapping a number); '
        f'keep every such marker exactly as-is, do not translate, reorder, or alter them.'
    )
    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': masked},
    ]
    max_tokens = max(512, min(8192, len(text) * 4))
    logger.info(f'[Translate] {src} → {target} ({len(text)} 字符, {len(math_store)} 处公式)')
    resp = client.chat.completions.create(
        model=model_name,
        messages=messages,
        max_tokens=max_tokens,
        temperature=LLM['translate_temperature'],
        stream=False,
    )
    content = (resp.choices[0].message.content or '').strip()
    # 思考型模型可能把推理放进 <think>…</think>，去除后只留译文
    content = _THINK_RE.sub('', content).strip()
    # 把占位符还原成原始公式
    content = _restore_math(content, math_store)
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
        temperature=LLM['summary_temperature'],
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


def _check_session(session_id, token):
    """校验会话令牌。返回 None 表示通过，否则返回要直接下发的 (响应, 状态码)。

    session_id 由客户端提供且可枚举，必须凭 Django 签发的令牌才能读写，
    否则任何人都能拿别人的 session_id 读取/污染其私聊记录。
    """
    from session_auth import verify as verify_session
    if not session_id:
        return jsonify({"error": "缺少 session_id"}), 400
    if not verify_session(session_id, token):
        logger.warning(f'[Rei] 拒绝无效会话令牌 (session={session_id}, from={request.remote_addr})')
        return jsonify({"error": "会话令牌无效或已过期"}), 401
    return None


@app.route("/rei/reply", methods=["POST"])
def rei_reply_endpoint():
    try:
        data = request.get_json()
        question_title = data.get("question_title", "")
        question_content = data.get("question_content", "")
        trigger_content = data.get("trigger_content", "")
        # 不再回退到 remote_addr：同一出口 IP（如校园网）下的用户会共享同一段历史
        session_id = (data.get("session_id") or "").strip()
        bad = _check_session(session_id, data.get("session_token"))
        if bad:
            return bad
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
    session_id = request.args.get("session_id", "").strip()
    bad = _check_session(session_id, request.args.get("session_token"))
    if bad:
        return bad
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
    # 不再回退到 remote_addr：同一出口 IP（如校园网）下的用户会共享同一段历史
    session_id = (data.get("session_id") or "").strip()
    bad = _check_session(session_id, data.get("session_token"))
    if bad:
        return bad
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
    from config_loader import cfg as _cfg
    flask_cfg = _cfg['flask']
    # 0.0.0.0：允许部署机之外的客户端（如打包后的 Electron 应用）连接。
    # debug 默认关闭——Werkzeug 的交互式调试器在暴露给公网时等同于远程代码执行，
    # 且当前接口均无鉴权；本地调试需要时在 config.json 或 REI_FLASK_DEBUG 打开。
    host = flask_cfg['host']
    port = flask_cfg['port']
    debug_mode = flask_cfg['debug']

    # 会话密钥缺失时 verify() 会拒绝一切请求（fail closed）。与其让 AI 聊天
    # 静默全线 401，不如在启动时就报错退出，把问题暴露给运维。
    import sys
    import session_auth
    try:
        session_auth.get_secret()
    except session_auth.SecretMissing as e:
        logger.error(f'[Rei] 启动中止：{e}')
        sys.exit(1)
    logger.info(f'[Flask] 模型服务启动于 {host}:{port}  mode={PUSH_MODE}  debug={debug_mode}')
    # 为已有记忆补齐向量 + 同步知识库/问答（best-effort，服务不可用时跳过）
    try:
        import rag
        rag.backfill_embeddings()
        rag.sync_all(force=True)
    except Exception as e:
        logger.warning(f'[RAG] 启动初始化跳过: {e}')
    app.run(host=host, port=port, debug=debug_mode)
