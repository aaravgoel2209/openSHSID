# 06 — Model Service: Flask AI Backend

> Applies to: [Index](index.md) · [Overview](01-overview.md) · [Quick Start](02-quickstart.md) · [Backend](03-backend.md) · [API](04-backend-api.md) · [Frontend](05-frontend.md) · [Deployment](07-deployment.md) · [Development](08-development.md)

A standalone Flask process (`model/app.py`, port 5000) providing the AI capabilities. It is not a Django app; it shares `config.json` and the `REI_SESSION_SECRET` with Django and talks to it over HTTP.

## 1. Endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/` | Health check |
| POST | `/rank` | Score/rank items with the recommendation model |
| POST | `/click` | Online BPR training step (click feedback) |
| POST | `/translate` | Chinese ↔ English translation (auto-detect) |
| POST | `/summarize` | LLM summarization (used by the OCR toolbox) |
| POST | `/rei/reply` | Blocking Rei reply (used by `@Rei` in Q&A) |
| GET | `/rei/history` | Session chat history |
| POST | `/rei/stream` | **SSE streaming** Rei reply (token-by-token) |

All `/rei/*` endpoints require a valid `session_id` + `session_token` (HMAC-signed by Django). Missing `REI_SESSION_SECRET` → the service refuses to start (fail closed).

## 2. Rei assistant — how a reply is built

1. **Persist** the user message to the session store.
2. **Compact** if cumulative context exceeds 100k tokens (fold old messages into a rolling LLM summary, physically delete them).
3. **Assemble** the prompt under a strict token budget (`context_budget.py`):
   - High priority head: system prompt (`SYSTEM.md`) + RAG context + the full Q&A thread (if any)
   - Rolling summary
   - History filled newest → oldest until the budget is exhausted; overflow gets folded into the summary
4. **RAG retrieval** (`rag.py`): embed the (coreference-resolved) query, rank candidates by cosine + keyword boost, apply **MMR** diversification, inject top hits with source labels (`memory` / `kb` / `qa`).
5. **Stream** the completion with up to 10 rounds of tool calling (`tools.py`: kb/qa/memory read & search, bing, weather), emitting `reasoning` / `content` / `tool` / `sources` / `done` events.

## 3. RAG internals

- Corpus syncs from Django (`kb` = articles, `qa` = questions) into the local `ext_chunks` table, throttled (300 s TTL), with MD5 change detection.
- Embeddings come from a separate llama.cpp embedding endpoint (`REI_EMBED_API_BASE`).
- Retrieval = one matrix–vector product against a cached embedding matrix (TTL 30 s), then MMR reranking.
- The memory bank (`items` table) is writable by Rei (`memory_create` / `memory_update`) — it records durable facts about users/school/courses.

## 4. Recommendation system

- **Dual-encoder PyTorch model** (`RecoModel`): 32-dim item/user embeddings → 64-dim → fusion → score in [0, 10].
- **BPR online training**: each `/click` runs a pairwise loss step (clicked vs. skipped), gradient-clipped, model saved every 10 steps to `model/data/model.pt`; training log in `model/data/log.jsonl`.
- **Algorithm fallback** (`push_mode: "algorithm"`): pure heat + embedding scoring without the network.
- Django and the model service share the heat weights via `config.json → ranking`.

## 5. OCR service

- **`ocr_infer.py`** wraps baidu **Unlimited-OCR** (transformers, local weights in `model/ocr/`). **Requires CUDA** — raises if no GPU. Lazy-loads weights on first call, serializes inference with a lock, enables TF32 + cudnn autotune.
- `ocr_pdf` renders pages via PyMuPDF (adaptive DPI, long edge 1536 px, cap 200) → Markdown text.
- **Structured mode** returns pages + selectable regions (`<|det|>type [x1,y1,x2,y2]`) for front-end highlighting.
- **Stream mode** yields NDJSON events (`meta` / `page` / `done`) so large PDFs don't time out.
- **`ocr_service.py`** is a standalone microservice (port 5001) so it can be deployed on a dedicated GPU box; returns 503 if the GPU/weights are unavailable.
- Docker note: the model service container does **not** bundle the OCR dependencies (`model/requirements-ocr.txt` is separate).

## 6. Model service data

- `model/data/local.db` — memory bank, chat history, session summaries, RAG chunk cache (independent of Django's SQLite).
- `model/data/model.pt` — recommendation weights; `model/data/log.jsonl` — training log.
- `model/model.gguf` — quantized Gemma-4-E4B LLM weights (llama.cpp format, referenced by `config.json llm.model_name`).

---

**Next**: [07 — Deployment](07-deployment.md)
