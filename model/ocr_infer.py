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
import sys
import tempfile
from pathlib import Path

# 本地权重目录；可用环境变量覆盖（例如把大文件放到别处）
MODEL_DIR = os.environ.get("OCR_MODEL_DIR", str(Path(__file__).resolve().parent / "ocr"))

# 单图 / 多页（PDF）分别用的提示词。含 <image> 占位符是模型必需的。
PROMPT_SINGLE = "<image>document parsing."
PROMPT_MULTI = "<image>Multi page parsing."

# 懒加载后的模型缓存
_state = {}


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


def pdf_to_images(pdf_path, dpi=200):
    """把 PDF 每页渲染成 PNG，返回图片路径列表（写入临时目录）。"""
    import fitz  # PyMuPDF

    doc = fitz.open(pdf_path)
    tmp_dir = tempfile.mkdtemp(prefix="pdf_ocr_")
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    paths = []
    for i, page in enumerate(doc):
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


def ocr_pdf(pdf_path, prompt=PROMPT_MULTI, dpi=200, image_size=1024):
    """PDF → Markdown 文本（多页 base 模式）。"""
    model, tokenizer = _load()
    images = pdf_to_images(pdf_path, dpi=dpi)
    out_dir = tempfile.mkdtemp(prefix="ocr_out_")
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


def ocr_pdf_structured(pdf_path, dpi=132, preview_max=1200):
    """PDF → {text, pages:[{index,image}], regions:[{id,page,type,bbox,text}]}。"""
    from PIL import Image

    model, tokenizer = _load()
    image_paths = pdf_to_images(pdf_path, dpi=dpi)
    out_dir = tempfile.mkdtemp(prefix="ocr_out_")
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


def ocr_image_structured(image_path, preview_max=1200):
    """单图 → 同 ocr_pdf_structured 的结构（单页）。"""
    from PIL import Image

    model, tokenizer = _load()
    out_dir = tempfile.mkdtemp(prefix="ocr_out_")
    text = model.infer(
        tokenizer, prompt=PROMPT_SINGLE, image_file=image_path, output_path=out_dir,
        base_size=1024, image_size=640, crop_mode=True, max_length=32768,
        no_repeat_ngram_size=35, ngram_window=128, eval_mode=True,
    ) or ""
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
