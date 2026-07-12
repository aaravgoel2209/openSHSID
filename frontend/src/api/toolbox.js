import client from './client';
import { API_BASE } from '../config';

// 工具箱·OCR 扫描：上传 PDF/图片 → 返回页面预览图 + 带版面框的可勾选区域
export async function ocrScan(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await client.post('/knowledge/ocr-scan/', fd);
  return r.data; // { filename, pages:[{index,image}], regions:[{id,page,type,bbox,text}], text }
}

// 流式 OCR 扫描：逐页读取 NDJSON，边识别边回调。大 PDF 不会一次性阻塞到超时。
// handlers: { onMeta({pages}), onPage({index,image,regions}), onDone({text}), signal }
// 返回 { text }。上游 503 / 出错时抛出带 message 的 Error（onPage 未触发前可安全回退到 ocrScan）。
export async function ocrScanStream(file, { onMeta, onPage, onDone, signal } = {}) {
  const fd = new FormData();
  fd.append('file', file);
  const token = localStorage.getItem('token');
  const resp = await fetch(`${API_BASE}/knowledge/ocr-scan-stream/`, {
    method: 'POST',
    headers: token ? { Authorization: `Token ${token}` } : {},
    body: fd,
    signal,
  });

  // 服务离线等：后端在升级为流之前用普通 JSON（含 503）返回
  const ctype = resp.headers.get('content-type') || '';
  if (!resp.ok && ctype.includes('application/json')) {
    let msg = 'OCR 服务不可用';
    try { msg = (await resp.json()).error || msg; } catch { /* ignore */ }
    const err = new Error(msg); err.status = resp.status; throw err;
  }
  if (!resp.ok) { const e = new Error(`HTTP ${resp.status}`); e.status = resp.status; throw e; }
  if (!resp.body || !resp.body.getReader) throw new Error('当前环境不支持流式读取');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.event === 'error') {
        const err = new Error(ev.error || 'OCR 识别失败'); err.status = ev.code; throw err;
      } else if (ev.event === 'meta') onMeta?.(ev);
      else if (ev.event === 'page') onPage?.(ev);
      else if (ev.event === 'done') { text = ev.text || ''; onDone?.(ev); }
    }
  }
  return { text };
}

// 把勾选的文本交给主聊天模型摘要
export async function summarizeText(text, instruction = '') {
  const r = await client.post('/knowledge/ocr-summarize/', { text, instruction });
  return r.data.summary;
}

// 把勾选的文本存入知识库
export async function saveToKnowledge(text, title = '') {
  const r = await client.post('/knowledge/ocr-save/', { text, title });
  return r.data; // { article_id, title }
}
