"""文档 OCR 客户端：调用本地模型服务（Flask /ocr 端点）把 PDF/图片转成 Markdown。

与 OpenSHSID_backend/translation.py 一致的 best-effort 约定：模型服务不可用时返回 None、
不抛异常，不影响主流程。OCR 依赖 GPU，通常只有模型后端机器能真正执行。

占位说明（本次为 knowledge 里的预留桩）：
  - 现在只做「上传文件 → OCR → 返回 Markdown」。
  - 之后接入：① LinkedClassroom PDF 自动拉取（走 crawler 的 download 代理）；
             ② Rei 大模型对 OCR 文本做摘要，再落库成知识库文章。
"""
import logging
import re

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _base(setting_name, default):
    """从 Django settings 取服务地址（settings 已内建 env 覆盖），去掉尾斜杠。"""
    return getattr(settings, setting_name, default).rstrip("/")


# OCR 微服务（model/ocr_service.py，跑在 GPU 机器上）与主聊天模型服务地址。
# 由 settings.OCR_SERVICE_URL / MODEL_SERVICE_URL 提供（可用同名环境变量覆盖）。
OCR_BASE = _base("OCR_SERVICE_URL", "http://192.168.2.103:5001")
OCR_URL = f"{OCR_BASE}/ocr"
CHATBOT_BASE = _base("MODEL_SERVICE_URL", "http://localhost:5000")

# Unlimited-OCR 输出的版面标记：<|det|>type [x1,y1,x2,y2]<|/det|>正文
_DET_RE = re.compile(
    r'<\|det\|>\s*([A-Za-z_]+)\s*\[([0-9,\s]*)\]\s*<\|/det\|>(.*?)(?=<\|det\|>|$)',
    re.DOTALL,
)


def parse_regions(text):
    """把 OCR 文本解析成可勾选的区域列表 [{id, type, bbox, text}]。

    仅保留有正文的区域（图片等空区域丢弃）。没有 <|det|> 标记时，按空行切段兜底。
    """
    text = text or ""
    regions = []
    for m in _DET_RE.finditer(text):
        content = m.group(3).strip().strip("-").strip()
        if not content:
            continue
        nums = [int(n) for n in re.findall(r"\d+", m.group(2))]
        regions.append({"type": m.group(1).lower(), "bbox": nums, "text": content})

    if not regions:
        for para in re.split(r"\n\s*\n", text):
            p = para.strip().strip("-").strip()
            if p:
                regions.append({"type": "text", "bbox": [], "text": p})

    for i, r in enumerate(regions):
        r["id"] = i
    return regions


def summarize(text, instruction="", timeout=180):
    """调用主聊天模型对文本做摘要。成功返回字符串；服务不可用/出错返回 None。"""
    text = (text or "").strip()
    if not text:
        return ""
    try:
        resp = requests.post(
            f"{CHATBOT_BASE}/summarize",
            json={"text": text, "instruction": instruction},
            timeout=timeout,
            proxies=_NO_PROXY,
        )
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            logger.error("[Summarize] 模型返回错误: %s", data["error"])
            return None
        return (data.get("summary") or "").strip()
    except requests.exceptions.RequestException as e:
        logger.error("[Summarize] 请求模型服务失败: %s", e)
        return None
    except Exception as e:  # noqa: BLE001
        logger.error("[Summarize] 摘要异常: %s", e, exc_info=True)
        return None

_NO_PROXY = {"http": None, "https": None}


def service_available(timeout=3):
    """快速探测 OCR 服务是否在线（不代表 GPU 已就绪；就绪状态见根路由的 ready 字段）。"""
    try:
        requests.get(f"{OCR_BASE}/", timeout=timeout, proxies=_NO_PROXY)
        return True
    except requests.exceptions.RequestException:
        return False


def ocr_document(file_bytes, filename, timeout=1200):
    """把文件字节送到模型服务做 OCR，返回 Markdown 文本。

    成功返回字符串；服务/依赖不可用或出错时返回 None（调用方据此优雅降级）。
    PDF 可能多页、耗时较长，默认超时放宽到 20 分钟。
    """
    if not file_bytes:
        return ""
    try:
        resp = requests.post(
            OCR_URL,
            files={"file": (filename, file_bytes)},
            timeout=timeout,
            proxies=_NO_PROXY,
        )
        if resp.status_code == 503:
            logger.warning("[OCR] 模型服务在线但 OCR 未就绪（无 GPU/权重）: %s", resp.text[:200])
            return None
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            logger.error("[OCR] 模型返回错误: %s", data["error"])
            return None
        return (data.get("text") or "").strip()
    except requests.exceptions.RequestException as e:
        logger.error("[OCR] 请求模型服务失败: %s", e)
        return None
    except Exception as e:  # noqa: BLE001
        logger.error("[OCR] 识别异常: %s", e, exc_info=True)
        return None


def ocr_document_structured(file_bytes, filename, timeout=1200):
    """结构化 OCR：返回 {text, pages:[{index,image}], regions:[{id,page,type,bbox,text}]}。

    成功返回 dict；服务/依赖不可用或出错时返回 None。bbox 为 0-999 归一化坐标。
    """
    if not file_bytes:
        return {"text": "", "pages": [], "regions": []}
    try:
        resp = requests.post(
            OCR_URL,
            files={"file": (filename, file_bytes)},
            data={"structured": "1"},
            timeout=timeout,
            proxies=_NO_PROXY,
        )
        if resp.status_code == 503:
            logger.warning("[OCR] OCR 未就绪（无 GPU/权重）: %s", resp.text[:200])
            return None
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            logger.error("[OCR] 模型返回错误: %s", data["error"])
            return None
        return {
            "text": (data.get("text") or "").strip(),
            "pages": data.get("pages") or [],
            "regions": data.get("regions") or [],
        }
    except requests.exceptions.RequestException as e:
        logger.error("[OCR] 请求模型服务失败: %s", e)
        return None
    except Exception as e:  # noqa: BLE001
        logger.error("[OCR] 结构化识别异常: %s", e, exc_info=True)
        return None
