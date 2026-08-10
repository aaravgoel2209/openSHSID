"""
上下文预算（Tier 1 修复）

问题：原先历史按「条数」截断（load_recent_messages limit=20），而 system 提示词、
RAG、整帖问答又一并注入，max_tokens 还写成 262144。总量一旦超过模型上下文窗口，
llama.cpp 会从**最前面**开始丢——也就是把 system 提示词（人格 + 安全条款）悄悄截掉，
且不报错。表现为「Rei 偶尔忘了自己是谁 / 忽略安全规则」。

这里改成按 token 预算装配：
- 固定预留输出 token 与安全余量；
- system / RAG / 问答帖 / 滚动摘要 视为高优先级，先占预算；
- 历史从**最新往回**填，直到预算用尽——丢的是最旧的，而不是最重要的 system。

远端部署的 Gemma 4 E4B 上下文为 256K，故窗口默认 262144。
以上均集中在 config.json 的 context_budget 段（仍可用同名 REI_* 环境变量覆盖）。

token 估算是启发式（无法拿到 Gemma 分词器）：CJK 约 1 token/字，其余约 1 token/3.5 字，
再加每条消息的角色开销。刻意略微高估，宁可少放历史也不要溢出。
"""
from config_loader import cfg

CB = cfg['context_budget']
CTX_WINDOW = CB['ctx_window']           # Gemma 4 E4B ≈ 256K
MAX_OUTPUT = CB['max_output']           # 预留给模型输出（256K 窗口下放宽）
SAFETY_MARGIN = CB['safety_margin']     # 估算误差余量
IMAGE_TOKENS = CB['image_tokens']       # 单张图片的粗略 token 成本
# 滚动摘要固定预留（无论当前有没有摘要都留这么多，让预算稳定、避免摘要更新后再溢出）
SUMMARY_RESERVE = CB['summary_reserve']
SUMMARY_MAX_TOKENS = CB['summary_max_tokens']
# 问答帖整贴注入的上限（超长帖会挤掉 system + 历史，必须封顶）；256K 窗口下可放宽
QA_MAX_TOKENS = CB['qa_max_tokens']


def _is_cjk(o):
    return (0x3400 <= o <= 0x9FFF or 0xF900 <= o <= 0xFAFF
            or 0x20000 <= o <= 0x2FA1F)


def estimate_tokens(text):
    """启发式 token 估算，略偏高。"""
    if not text:
        return 0
    cjk = 0
    for ch in text:
        if _is_cjk(ord(ch)):
            cjk += 1
    other = len(text) - cjk
    return int(cjk * 1.2 + other / 3.5) + 4


def message_tokens(msg):
    """单条消息的 token 估算，兼容多模态 list 内容。"""
    c = msg.get('content')
    if isinstance(c, list):
        t = 0
        for part in c:
            if not isinstance(part, dict):
                continue
            if part.get('type') == 'text':
                t += estimate_tokens(part.get('text', ''))
            elif part.get('type') == 'image_url':
                t += IMAGE_TOKENS
        return t + 4
    return estimate_tokens(c or '') + 4


def messages_tokens(msgs):
    return sum(message_tokens(m) for m in msgs)


def history_budget(head_tokens):
    """扣掉输出预留、安全余量、head（system/RAG/问答/摘要预留）后，留给历史的 token。"""
    return max(0, CTX_WINDOW - MAX_OUTPUT - SAFETY_MARGIN - head_tokens)


def fit_history(messages, budget):
    """messages 为 oldest→newest。保留能装进 budget 的**最新**若干条，
    返回 (kept, overflow)。始终至少保留最后一条（当前这轮不能丢）。"""
    if not messages:
        return [], []
    kept_count = 0
    total = 0
    n = len(messages)
    for i in range(n - 1, -1, -1):
        t = message_tokens(messages[i])
        if kept_count and total + t > budget:
            break
        total += t
        kept_count += 1
    kept = messages[n - kept_count:]
    overflow = messages[:n - kept_count]
    return kept, overflow


def truncate_to_tokens(text, max_tokens):
    """把文本截到约 max_tokens（按字符比例，够用即可）。"""
    if not text:
        return text
    est = estimate_tokens(text)
    if est <= max_tokens:
        return text
    ratio = max_tokens / est
    cut = max(1, int(len(text) * ratio))
    return text[:cut].rstrip() + '…'


_SENT_ENDS = '。！？!?.\n'


def _snap_head(text, limit):
    """把开头截断点吸附到 limit 之前的最近句子边界（边界离上限不太远才用）。"""
    cut = max(text.rfind(c, 0, limit) for c in _SENT_ENDS)
    if cut >= limit * 0.5:
        return cut + 1
    return limit


def _snap_tail(text, start):
    """把尾部起始点吸附到 start 之后的最近句子边界，返回最终起始位置。"""
    best = -1
    for c in _SENT_ENDS:
        i = text.find(c, start)
        if i != -1 and (best == -1 or i < best):
            best = i
    if best != -1 and best - start <= (len(text) - start) * 0.5:
        return best + 1
    return start


def truncate_preserve_edges(text, max_tokens, head_ratio=0.3):
    """超长文本截断并保留两端：开头（问题与早期回答）+ 结尾（最新回答）。
    问答帖整贴注入必须用这个——若只留开头，超长帖会把触发回复的最新回答
    （通常在末尾）切掉，Rei 就看不到自己正在回复的内容。中间折叠成省略标记。"""
    if not text:
        return text
    est = estimate_tokens(text)
    if est <= max_tokens:
        return text
    seam = '\n…（中间内容已截断）…\n'
    budget = max(200, max_tokens - estimate_tokens(seam))
    head_chars = max(1, int(len(text) * (budget * head_ratio) / est))
    tail_chars = max(1, int(len(text) * (budget * (1 - head_ratio)) / est))
    head_end = _snap_head(text, head_chars)
    tail_start = _snap_tail(text, len(text) - tail_chars)
    if head_end >= tail_start:  # 吸附后重叠（极短文本），退化为只保留尾部
        tail_start = len(text) - tail_chars
    return f'{text[:head_end]}{seam}{text[tail_start:]}'
