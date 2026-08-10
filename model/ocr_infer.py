"""Unlimited-OCR 推理封装。

把本地 model/ocr（baidu/Unlimited-OCR）权重加载进来，将图片 / PDF 转成 Markdown 文本。

特点：
  - 懒加载：首次调用时才载入模型，避免拖慢 / 拖垮无需 OCR 的进程（如 Flask 主服务导入本模块时不会立刻吃显存）。
  - 需要 CUDA GPU：模型自定义代码里硬编码了 `.cuda()` / `torch.autocast("cuda")`，无法在 CPU 上跑；无 GPU 时给出清晰报错。
  - 依赖见 model/requirements-ocr.txt（transformers / torchvision / pymupdf / einops 等）。

命令行用法（作为独立推理脚本）：
    python ocr_infer.py path/to/doc.pdf                # 打印 Markdown
    python ocr_infer.py path/to/scan.png -o out.md     # 写入文件
"""
import argparse
import os
import re
import shutil
import sys
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path

from config_loader import cfg, ROOT

OC = cfg['ocr']

# 本地权重目录（config.json ocr.model_dir，仍可用 OCR_MODEL_DIR 环境变量覆盖）
MODEL_DIR = str(ROOT / OC['model_dir'])

# 单图 / 多页（PDF）分别用的提示词。含 <image> 占位符是模型必需的。
PROMPT_SINGLE = "<image>document parsing."
PROMPT_MULTI = "<image>Multi page parsing."

# PDF 渲染参数（性能相关，config.json ocr 段）：
#   模型内部会把图片缩放到 image_size(≈1024)，所以按固定 200 DPI 渲染 A4（长边≈2339px）
#   纯属浪费——渲染/编码/解码的都是随后被丢弃的像素。改为按目标长边像素自适应缩放，
#   长边约取 image_size 的 1.5 倍即够清晰，并以 DPI 上限兜底。
_PDF_DPI_CAP = OC['pdf_dpi_cap']          # 渲染 DPI 上限
_PDF_TARGET_PX = OC['pdf_target_px']      # 目标长边像素

# 懒加载后的模型缓存
_state = {}

# GPU 推理串行锁：单卡上并发跑 model.infer 只会争显存 / 触发 OOM，用锁排队反而尾延迟更稳。
_infer_lock = threading.Lock()


def _configure_perf(torch):
    """Ampere+ 上打开 TF32 与 cudnn autotune。对固定输入尺寸的矩阵/卷积有稳定加速，
    bf16 权重下不影响可读性精度。可在 config.json ocr.tf32 / ocr.cudnn_benchmark 关闭以便排查。"""
    try:
        if OC['tf32']:
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True
        if OC['cudnn_benchmark']:
            # 输入尺寸基本固定（image_size 常量），autotune 一次后持续复用最快卷积算法。
            torch.backends.cudnn.benchmark = True
    except Exception:
        pass


@contextmanager
def _inference():
    """所有 GPU 推理的统一入口：串行锁 + inference_mode（免去 autograd 记录，省显存更快）。"""
    import torch

    with _infer_lock, torch.inference_mode():
        yield


def _rmtree(path):
    """静默删掉临时目录（每次请求会产生渲染图 / 模型输出目录，不清会把磁盘撑爆）。"""
    if path:
        shutil.rmtree(path, ignore_errors=True)


def _load():
    """加载并缓存 (model, tokenizer)。仅首次调用时真正载入权重。"""
    if "model" in _state:
        return _state["model"], _state["tokenizer"]

    import torch
    from transformers import AutoModel, AutoTokenizer

    if not torch.cuda.is_available():
        raise RuntimeError(
            "Unlimited-OCR 需要 CUDA GPU（模型内部硬编码了 .cuda()），当前环境不可用。"
            "请在带 GPU 的模型后端机器上运行 OCR。"
        )

    if not os.path.isdir(MODEL_DIR):
        raise FileNotFoundError(f"OCR 权重目录不存在: {MODEL_DIR}（设 OCR_MODEL_DIR 指向权重）")

    _configure_perf(torch)

    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR, trust_remote_code=True)
    model = AutoModel.from_pretrained(
        MODEL_DIR,
        trust_remote_code=True,
        use_safetensors=True,
        torch_dtype=torch.bfloat16,
    )
    model = model.eval().cuda()

    _state["model"] = model
    _state["tokenizer"] = tokenizer
    return model, tokenizer


def is_available():
    """轻量探测：GPU 与权重是否具备（不加载模型）。"""
    try:
        import torch
    except Exception:
        return False
    return bool(getattr(torch, "cuda", None) and torch.cuda.is_available()) and os.path.isdir(MODEL_DIR)


def pdf_to_images(pdf_path, dpi=200, target_px=None):
    """把 PDF 每页渲染成 PNG，返回图片路径列表（写入临时目录）。

    target_px 给定时按「目标长边像素」自适应缩放（每页按自身尺寸算缩放比，
    再以 dpi 为上限兜底），避免固定高 DPI 渲染出远超模型所需分辨率的大图；
    为 None 时退回固定 dpi 渲染（供 CLI 显式指定 --dpi）。
    """
    import fitz  # PyMuPDF

    doc = fitz.open(pdf_path)
    tmp_dir = tempfile.mkdtemp(prefix="pdf_ocr_")
    dpi_zoom = dpi / 72.0
    paths = []
    for i, page in enumerate(doc):
        if target_px:
            long_pt = max(page.rect.width, page.rect.height) or 1.0
            zoom = min(target_px / long_pt, dpi_zoom)  # 达到目标像素即可，但不超过 DPI 上限
        else:
            zoom = dpi_zoom
        mat = fitz.Matrix(zoom, zoom)
        out = os.path.join(tmp_dir, f"page_{i + 1:04d}.png")
        page.get_pixmap(matrix=mat).save(out)
        paths.append(out)
    doc.close()
    return paths


def _normalize(text):
    """把模型输出的 <PAGE> 分隔符规整成 Markdown 分页线。"""
    if not text:
        return ""
    text = text.replace("<PAGE>\n", "\n\n---\n\n").replace("<PAGE>", "\n\n---\n\n")
    return text.strip().lstrip("-").strip()


def ocr_image(image_path, prompt=PROMPT_SINGLE, base_size=1024, image_size=640, crop_mode=True):
    """单张图片 → Markdown 文本。默认用 gundam 配置（含裁剪）。"""
    model, tokenizer = _load()
    out_dir = tempfile.mkdtemp(prefix="ocr_out_")
    try:
        with _inference():
            text = model.infer(
                tokenizer,
                prompt=prompt,
                image_file=image_path,
                output_path=out_dir,
                base_size=base_size,
                image_size=image_size,
                crop_mode=crop_mode,
                max_length=32768,
                no_repeat_ngram_size=35,
                ngram_window=128,
                eval_mode=True,  # 直接返回解码后的字符串
            )
        return _normalize(text or "")
    finally:
        _rmtree(out_dir)


def ocr_pdf(pdf_path, prompt=PROMPT_MULTI, dpi=None, image_size=1024):
    """PDF → Markdown 文本（多页 base 模式）。

    dpi 显式给定（如 CLI --dpi）时按该固定 DPI 渲染；否则按目标长边像素自适应，
    只渲染模型实际需要的分辨率。
    """
    model, tokenizer = _load()
    if dpi:
        images = pdf_to_images(pdf_path, dpi=dpi)
    else:
        images = pdf_to_images(pdf_path, dpi=_PDF_DPI_CAP, target_px=_PDF_TARGET_PX)
    img_dir = os.path.dirname(images[0]) if images else None
    out_dir = tempfile.mkdtemp(prefix="ocr_out_")
    try:
        with _inference():
            outputs, _tokens = model.infer_multi(
                tokenizer,
                prompt=prompt,
                image_files=images,
                output_path=out_dir,
                image_size=image_size,
                max_length=32768,
                no_repeat_ngram_size=35,
                ngram_window=1024,
            )
        return _normalize(outputs or "")
    finally:
        _rmtree(out_dir)
        _rmtree(img_dir)


def ocr_file(path):
    """按扩展名分派：PDF 走多页，其它按单图处理。返回 Markdown 文本。"""
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        return ocr_pdf(path)
    return ocr_image(path)


# ---- 结构化输出（带版面框，供前端画框勾选）------------------------------------
# Unlimited-OCR 输出的版面标记：<|det|>type [x1,y1,x2,y2]<|/det|>正文；坐标为 0-999 归一化。
_DET_RE = re.compile(
    r"<\|det\|>\s*([A-Za-z_]+)\s*\[([0-9,\s]*)\]\s*<\|/det\|>(.*?)(?=<\|det\|>|$)",
    re.DOTALL,
)


def _img_to_data_url(pil_img, max_side=1200, quality=70):
    """PIL 图片 → 压缩后的 data URL（JPEG），控制传输体积。"""
    import base64
    import io

    w, h = pil_img.size
    if max(w, h) > max_side:
        s = max_side / max(w, h)
        pil_img = pil_img.resize((max(1, int(w * s)), max(1, int(h * s))))
    buf = io.BytesIO()
    pil_img.convert("RGB").save(buf, format="JPEG", quality=quality)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _parse_page_regions(page_text):
    """从单页文本解析 [{type, bbox:[x1,y1,x2,y2](0-999), text}]，丢弃空区域。"""
    regions = []
    for m in _DET_RE.finditer(page_text or ""):
        content = m.group(3).strip().strip("-").strip()
        if not content:
            continue
        nums = [int(n) for n in re.findall(r"\d+", m.group(2))]
        if len(nums) >= 4:
            regions.append({"type": m.group(1).lower(), "bbox": nums[:4], "text": content})
    return regions


def ocr_pdf_structured(pdf_path, preview_max=1200):
    """PDF → {text, pages:[{index,image}], regions:[{id,page,type,bbox,text}]}。"""
    from PIL import Image

    model, tokenizer = _load()
    image_paths = pdf_to_images(pdf_path, dpi=_PDF_DPI_CAP, target_px=_PDF_TARGET_PX)
    img_dir = os.path.dirname(image_paths[0]) if image_paths else None
    out_dir = tempfile.mkdtemp(prefix="ocr_out_")
    try:
        with _inference():
            outputs, _tokens = model.infer_multi(
                tokenizer, prompt=PROMPT_MULTI, image_files=image_paths, output_path=out_dir,
                image_size=1024, max_length=32768, no_repeat_ngram_size=35, ngram_window=1024,
            )
        # infer_multi 输出形如 '<PAGE>\n' + '\n<PAGE>\n'.join(pages)
        chunks = (outputs or "").split("<PAGE>")
        page_texts = chunks[1:] if chunks and chunks[0].strip() == "" else chunks

        pages, regions, gid = [], [], 0
        for i, img_path in enumerate(image_paths):
            with Image.open(img_path) as im:
                pages.append({"index": i, "image": _img_to_data_url(im.copy(), preview_max)})
            ptext = page_texts[i] if i < len(page_texts) else ""
            for r in _parse_page_regions(ptext):
                r["id"] = gid; r["page"] = i; gid += 1
                regions.append(r)
        return {"text": _normalize(outputs or ""), "pages": pages, "regions": regions}
    finally:
        _rmtree(out_dir)
        _rmtree(img_dir)


def ocr_image_structured(image_path, preview_max=1200):
    """单图 → 同 ocr_pdf_structured 的结构（单页）。"""
    from PIL import Image

    model, tokenizer = _load()
    out_dir = tempfile.mkdtemp(prefix="ocr_out_")
    try:
        with _inference():
            text = model.infer(
                tokenizer, prompt=PROMPT_SINGLE, image_file=image_path, output_path=out_dir,
                base_size=1024, image_size=640, crop_mode=True, max_length=32768,
                no_repeat_ngram_size=35, ngram_window=128, eval_mode=True,
            ) or ""
    finally:
        _rmtree(out_dir)
    with Image.open(image_path) as im:
        data_url = _img_to_data_url(im.copy(), preview_max)
    regions = []
    for gid, r in enumerate(_parse_page_regions(text)):
        r["id"] = gid; r["page"] = 0
        regions.append(r)
    return {"text": _normalize(text), "pages": [{"index": 0, "image": data_url}], "regions": regions}


def ocr_file_structured(path):
    """按扩展名分派的结构化 OCR。返回 {text, pages, regions}。"""
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        return ocr_pdf_structured(path)
    return ocr_image_structured(path)


# ---- 流式结构化输出（逐页产出，避免大 PDF 单次阻塞导致上游超时）------------------
# 生成器产出 (event, payload) 元组，由上层（ocr_service）序列化成 NDJSON 逐行下发：
#   ("meta", {"pages": N})                          总页数，前端可先建进度
#   ("page", {"index", "image", "regions":[...]})   每识别完一页即产出（含预览图 + 区域）
#   ("done", {"text": "<全文>"})                      收尾，给出拼接后的完整 Markdown
# 逐页调用单图推理（PROMPT_SINGLE）而非 infer_multi：每次 GPU 调用都短、有心跳、可增量。

def _ocr_page_structured(model, tokenizer, img_path, gid_start, page_index, preview_max):
    """对单页渲染图做结构化识别，返回 (page_text, regions, next_gid)。"""
    from PIL import Image

    out_dir = tempfile.mkdtemp(prefix="ocr_out_")
    try:
        with _inference():
            text = model.infer(
                tokenizer, prompt=PROMPT_SINGLE, image_file=img_path, output_path=out_dir,
                base_size=1024, image_size=640, crop_mode=True, max_length=32768,
                no_repeat_ngram_size=35, ngram_window=128, eval_mode=True,
            ) or ""
    finally:
        _rmtree(out_dir)
    with Image.open(img_path) as im:
        data_url = _img_to_data_url(im.copy(), preview_max)
    regions, gid = [], gid_start
    for r in _parse_page_regions(text):
        r["id"] = gid; r["page"] = page_index; gid += 1
        regions.append(r)
    return _normalize(text), data_url, regions, gid


def ocr_pdf_structured_stream(pdf_path, preview_max=1200):
    """PDF → 逐页产出结构化事件的生成器（见上方事件约定）。"""
    model, tokenizer = _load()
    image_paths = pdf_to_images(pdf_path, dpi=_PDF_DPI_CAP, target_px=_PDF_TARGET_PX)
    img_dir = os.path.dirname(image_paths[0]) if image_paths else None
    try:
        yield ("meta", {"pages": len(image_paths)})
        all_text, gid = [], 0
        for i, img_path in enumerate(image_paths):
            ptext, data_url, regions, gid = _ocr_page_structured(
                model, tokenizer, img_path, gid, i, preview_max
            )
            if ptext:
                all_text.append(ptext)
            yield ("page", {"index": i, "image": data_url, "regions": regions})
        yield ("done", {"text": "\n\n---\n\n".join(all_text)})
    finally:
        _rmtree(img_dir)


def ocr_file_structured_stream(path):
    """按扩展名分派的流式结构化 OCR 生成器。图片按单页处理。"""
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        yield from ocr_pdf_structured_stream(path)
        return
    # 单图：一页，复用已有单图结构化，再包装成同样的事件流
    res = ocr_image_structured(path)
    page = (res.get("pages") or [{}])[0]
    yield ("meta", {"pages": 1})
    yield ("page", {"index": 0, "image": page.get("image", ""), "regions": res.get("regions", [])})
    yield ("done", {"text": res.get("text", "")})


def warmup():
    """预热：加载权重并跑一次极小推理，把首请求要付的加载 / CUDA 上下文 / 卷积 autotune /
    首次生成开销前移到服务启动阶段。无 GPU / 权重时静默跳过（返回 False，不抛异常）。"""
    tmp_path = None
    try:
        from PIL import Image

        _load()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            tmp_path = tmp.name
        Image.new("RGB", (64, 64), "white").save(tmp_path)
        ocr_image(tmp_path)
        return True
    except Exception:
        return False
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def _main(argv=None):
    parser = argparse.ArgumentParser(description="Unlimited-OCR 推理：图片 / PDF → Markdown")
    parser.add_argument("input", help="输入文件（.pdf / .png / .jpg …）")
    parser.add_argument("-o", "--output", help="输出 Markdown 文件路径；省略则打印到标准输出")
    parser.add_argument("--dpi", type=int, default=200, help="PDF 渲染 DPI（默认 200）")
    args = parser.parse_args(argv)

    if not os.path.isfile(args.input):
        parser.error(f"文件不存在: {args.input}")

    ext = Path(args.input).suffix.lower()
    text = ocr_pdf(args.input, dpi=args.dpi) if ext == ".pdf" else ocr_image(args.input)

    if args.output:
        Path(args.output).write_text(text, encoding="utf-8")
        print(f"已写入 {args.output}（{len(text)} 字符）", file=sys.stderr)
    else:
        print(text)


if __name__ == "__main__":
    _main()
