"""中英互译辅助：调用本地模型服务（Flask /translate 端点）做翻译并缓存。

用于发布问答/文章时自动把内容翻译成另一种语言，缓存在数据库中供前端按语言切换显示。
所有调用均为 best-effort：模型服务不可用时返回 None / 不抛异常，不影响主流程。
"""
import logging
import threading

import requests

logger = logging.getLogger(__name__)

# 本地模型服务（model/app.py）翻译端点；直连、绕过系统代理
TRANSLATE_URL = "http://localhost:5000/translate"
_NO_PROXY = {"http": None, "https": None}


def detect_lang(text):
    """粗略判断主体语言：中日韩统一表意文字多于 ASCII 字母则为中文，否则英文。"""
    if not text:
        return "en"
    cjk = sum(1 for ch in text if "一" <= ch <= "鿿")
    letters = sum(1 for ch in text if ch.isascii() and ch.isalpha())
    return "zh" if cjk >= letters else "en"


def translate(text, target=None, timeout=120):
    """把 text 翻译到 target（'zh'/'en'；为空则自动取相反语言）。
    成功返回译文字符串；失败返回 None。"""
    text = (text or "").strip()
    if not text:
        return ""
    try:
        resp = requests.post(
            TRANSLATE_URL,
            json={"text": text, "target": target},
            timeout=timeout,
            proxies=_NO_PROXY,
        )
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            logger.error("[Translate] 模型返回错误: %s", data["error"])
            return None
        return (data.get("translation") or "").strip()
    except requests.exceptions.RequestException as e:
        logger.error("[Translate] 请求模型服务失败: %s", e)
        return None
    except Exception as e:  # noqa: BLE001
        logger.error("[Translate] 翻译异常: %s", e, exc_info=True)
        return None


def service_available(timeout=3):
    """快速探测模型服务是否在线（供数据迁移批量翻译前判断）。"""
    try:
        requests.get("http://localhost:5000/", timeout=timeout, proxies=_NO_PROXY)
        return True
    except requests.exceptions.RequestException:
        return False


def build_translation(title, content, source_lang=None):
    """检测源语言并把 title/content 翻译到另一种语言。
    返回 (source_lang, title_translated, content_translated)。
    任一翻译失败时对应字段为 ''（保持空，便于以后重试）。"""
    src = source_lang or detect_lang(f"{title}\n{content}")
    target = "en" if src == "zh" else "zh"
    title_t = translate(title, target) or "" if title else ""
    content_t = translate(content, target) or "" if content else ""
    return src, title_t, content_t


def translate_instance(instance):
    """同步：为带 title/content 的模型实例填充 source_lang/title_translated/content_translated 并保存。"""
    src, title_t, content_t = build_translation(
        getattr(instance, "title", ""), getattr(instance, "content", ""),
        source_lang=getattr(instance, "source_lang", "") or None,
    )
    instance.source_lang = src
    instance.title_translated = title_t[:400]
    instance.content_translated = content_t
    instance.save(update_fields=["source_lang", "title_translated", "content_translated"])
    logger.info("[Translate] 已缓存译文 %s#%s (%s→%s)", type(instance).__name__, instance.pk, src,
                "en" if src == "zh" else "zh")


def translate_instance_async(instance):
    """后台线程触发 translate_instance，不阻塞请求；失败仅记录日志。"""
    def _run():
        try:
            translate_instance(instance)
        except Exception as e:  # noqa: BLE001
            logger.error("[Translate] 后台翻译失败 %s#%s: %s",
                         type(instance).__name__, getattr(instance, "pk", "?"), e, exc_info=True)

    threading.Thread(target=_run, daemon=True).start()
