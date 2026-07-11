import client from './client';

// 工具箱·OCR 扫描：上传 PDF/图片 → 返回页面预览图 + 带版面框的可勾选区域
export async function ocrScan(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await client.post('/knowledge/ocr-scan/', fd);
  return r.data; // { filename, pages:[{index,image}], regions:[{id,page,type,bbox,text}], text }
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
