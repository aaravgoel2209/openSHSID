"""独立 OCR 微服务（可单独部署到带 CUDA 的机器，如 192.168.2.103）。

与主模型服务（app.py：排序/训练/Rei 聊天）解耦——只依赖 ocr_infer + flask，
方便把「ocr_infer.py + ocr_service.py + requirements-ocr.txt + ocr/ 权重」整体拷到
GPU 机器上单独运行，不需要拖上 torch 排序模型 / openai 等其它依赖。

部署（在 192.168.2.103 上）：
    pip install -r requirements-ocr.txt flask flask-cors
    python ocr_service.py                     # 默认 0.0.0.0:5001
    # 或自定义： OCR_HOST=0.0.0.0 OCR_PORT=5001 python ocr_service.py

端点：
    GET  /       健康检查 + OCR 是否就绪（不加载模型）
    POST /ocr    图片/PDF → Markdown（懒加载模型；无 GPU/权重时 503）

Django 侧通过环境变量 OCR_SERVICE_URL 指向本服务（见 knowledge/ocr_client.py）。
"""
import base64
import logging
import os
import tempfile

from flask import Flask, request, jsonify
from flask_cors import CORS

import ocr_infer

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ocr_service")

app = Flask(__name__)
CORS(app)


@app.route("/")
def index():
    # is_available() 只探测 GPU + 权重是否具备，不会加载模型
    return {"status": "ok", "service": "ocr", "ready": ocr_infer.is_available()}


@app.route("/ocr", methods=["POST"])
def ocr_endpoint():
    """文档 OCR：图片 / PDF → Markdown 文本（baidu/Unlimited-OCR）。

    接受两种请求体：
      1. multipart/form-data，字段名 file（推荐，适合大 PDF）；可带 structured=1
      2. application/json：{"filename": "x.pdf", "content_base64": "...", "structured": true}

    structured 为真时返回 {"pages":[{index,image}], "regions":[{id,page,type,bbox,text}], "text"}，
    其中 bbox 为 0-999 归一化坐标、image 为该页预览图 data URL（供前端画框勾选）；
    否则返回 {"text": "<markdown>", "chars": <int>}。
    OCR 依赖 GPU + 权重，未就绪时返回 503（best-effort，调用方可优雅降级）。
    懒加载：仅本端点被调用时才载入 OCR 模型。
    """
    # 取文件字节 + 文件名 + 是否结构化
    filename, raw, structured = None, None, False
    if "file" in request.files:
        f = request.files["file"]
        filename = f.filename or "upload"
        raw = f.read()
        structured = str(request.form.get("structured", "")).lower() in ("1", "true", "yes")
    else:
        data = request.get_json(silent=True) or {}
        b64 = data.get("content_base64")
        filename = data.get("filename") or "upload"
        structured = bool(data.get("structured"))
        if b64:
            try:
                raw = base64.b64decode(b64)
            except Exception as e:
                return jsonify({"error": f"content_base64 解码失败: {e}"}), 400

    if not raw:
        return jsonify({"error": "缺少文件：请用 multipart 的 file 字段或 JSON 的 content_base64"}), 400

    suffix = os.path.splitext(filename)[1].lower() or ".pdf"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(raw)
        tmp.close()
        logger.info(f"[OCR] 开始识别 {filename} ({len(raw)} bytes, suffix={suffix}, structured={structured})")
        if structured:
            result = ocr_infer.ocr_file_structured(tmp.name)
            logger.info(f"[OCR] 完成: {len(result.get('regions', []))} 区域 / {len(result.get('pages', []))} 页")
            return jsonify(result)
        text = ocr_infer.ocr_file(tmp.name)
        logger.info(f"[OCR] 完成: {len(text)} 字符")
        return jsonify({"text": text, "chars": len(text)})
    except RuntimeError as e:  # 无 GPU / 权重缺失等环境问题
        logger.error(f"[OCR] 环境不可用: {e}")
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        logger.error(f"[OCR] 识别失败: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


if __name__ == "__main__":
    host = os.environ.get("OCR_HOST", "0.0.0.0")
    port = int(os.environ.get("OCR_PORT", "5001"))
    debug = os.environ.get("OCR_DEBUG", "0") == "1"
    logger.info(f"[OCR] 独立 OCR 服务启动于 {host}:{port}  ready={ocr_infer.is_available()}")
    app.run(host=host, port=port, debug=debug)
