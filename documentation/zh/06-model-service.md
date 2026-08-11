# 06 — 模型服务：Flask AI 后端

> 相关文档：[目录](index.md) · [概述](01-overview.md) · [快速开始](02-quickstart.md) · [后端](03-backend.md) · [API](04-backend-api.md) · [前端](05-frontend.md) · [部署](07-deployment.md) · [开发规范](08-development.md)

独立 Flask 进程（`model/app.py`，端口 5000），提供全部 AI 能力。它不是 Django app；与 Django 共享 `config.json` 和 `REI_SESSION_SECRET`，并通过 HTTP 通信。

## 1. 端点

| 方法 | 路由 | 用途 |
|---|---|---|
| GET | `/` | 健康检查 |
| POST | `/rank` | 用推荐模型打分/排序 |
| POST | `/click` | 在线 BPR 训练（点击反馈） |
| POST | `/translate` | 中 ↔ 英翻译（自动检测语种） |
| POST | `/summarize` | LLM 总结（OCR 工具箱使用） |
| POST | `/rei/reply` | 阻塞式 Rei 回复（问答 @Rei 使用） |
| GET | `/rei/history` | 会话历史 |
| POST | `/rei/stream` | **SSE 流式** Rei 回复（逐 token） |

所有 `/rei/*` 端点都要求携带有效的 `session_id` + `session_token`（Django HMAC 签名）。缺少 `REI_SESSION_SECRET` 时服务拒绝启动（fail closed）。

## 2. Rei 助手的回复构建流程

1. **持久化**：将用户消息写入会话存储。
2. **压缩**：累计上下文超过 100k token 时，将旧消息折叠进滚动摘要并物理删除。
3. **装配**：在严格的 token 预算内（`context_budget.py`）组装提示词：
   - 高优先级头部：系统提示词（`SYSTEM.md`）+ RAG 上下文 + 完整问答帖（如有）
   - 滚动摘要
   - 历史消息按新 → 旧填充直到预算耗尽；溢出部分折叠进摘要
4. **RAG 检索**（`rag.py`）：对（消解了指代后的）查询做向量化，按余弦 + 关键词加成排序，再用 **MMR** 去重增强多样性，注入带来源标签（`memory` / `kb` / `qa`）的命中内容。
5. **流式生成**：支持最多 10 轮工具调用（`tools.py`：kb/qa/memory 读取与搜索、Bing、天气），输出 `reasoning` / `content` / `tool` / `sources` / `done` 事件。

## 3. RAG 内部机制

- 语料从 Django 同步（`kb` = 文章，`qa` = 问题）到本地 `ext_chunks` 表，节流同步（300 秒 TTL），MD5 变化检测。
- 向量来自独立的 llama.cpp embedding 接口（`REI_EMBED_API_BASE`）。
- 检索 = 对缓存的向量矩阵做一次矩阵-向量乘积（TTL 30 秒），再做 MMR 重排。
- 记忆库（`items` 表）可由 Rei 写入（`memory_create` / `memory_update`）——用于记录关于用户、学校、课程的持久事实。

## 4. 推荐系统

- **双编码器 PyTorch 模型**（`RecoModel`）：32 维 item/user 向量 → 64 维 → 融合 → [0, 10] 分数。
- **BPR 在线训练**：每次 `/click` 执行一次成对损失（点击 vs 跳过）训练步，梯度裁剪，每 10 步保存到 `model/data/model.pt`；训练日志写入 `model/data/log.jsonl`。
- **算法兜底**（`push_mode: "algorithm"`）：不依赖神经网络，纯热度 + 向量打分。
- Django 与模型服务通过 `config.json → ranking` 共享热度权重。

## 5. OCR 服务

- **`ocr_infer.py`** 封装 baidu **Unlimited-OCR**（transformers，本地权重在 `model/ocr/`）。**必须 CUDA** —— 无 GPU 直接报错。首次调用才加载权重（懒加载），推理加锁串行，开启 TF32 + cudnn autotune。
- `ocr_pdf` 用 PyMuPDF 渲染页面（自适应 DPI，长边 1536px，上限 200）→ Markdown 文本。
- **结构化模式**返回页面与可选区域（`<|det|>type [x1,y1,x2,y2]`），供前端高亮。
- **流式模式**输出 NDJSON 事件（`meta` / `page` / `done`），大 PDF 不会超时。
- **`ocr_service.py`** 是独立微服务（端口 5001），可单独部署到 GPU 机器；GPU/权重不可用时返回 503。
- Docker 注意：模型服务容器**不包含** OCR 依赖（`model/requirements-ocr.txt` 独立安装）。

## 6. 模型服务数据

- `model/data/local.db` —— 记忆库、对话历史、会话摘要、RAG 分块缓存（独立于 Django 的 SQLite）。
- `model/data/model.pt` —— 推荐模型权重；`model/data/log.jsonl` —— 训练日志。
- `model/model.gguf` —— 量化 Gemma-4-E4B LLM 权重（llama.cpp 格式，对应 `config.json llm.model_name`）。

---

**下一篇**：[07 — 部署](07-deployment.md)
