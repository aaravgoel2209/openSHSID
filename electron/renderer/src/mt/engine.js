// frontend/src/mt/engine.js
//
// 服务端 LLM 翻译引擎（原浏览器端 OPUS-MT Web Worker 已退役）。
// 翻译工作改为 POST Flask 模型服务的 /translate（与 Rei 助手同一 LLM 后端，
// 模型由 config.json 的 llm.model_name 指定），无模型下载、无浏览器缓存。
//
// 公开 API（保持 MtTranslateBar 的既有调用形状）：
//   translateArticle({ title, content, srcLang, target })
//     -> { title, content, translated: true, mt: true, relayed: false }
//   isModelCached() -> Promise<true>  （模型始终在服务端可用；保留仅为接口稳定）
//
// 失败时 translateArticle() 抛错 —— 调用方（MtTranslateBar）捕获并显示 t('mt.failed')。

import { FLASK_BASE } from '../config.js';

// 单段文本翻译：POST /translate，返回 { translation, source_lang, target_lang }。
// 服务端出错（非 2xx 或载荷携带 error）时抛出 Error，消息取服务端 error 字段。
async function postTranslate(text, target) {
  const resp = await fetch(`${FLASK_BASE}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target }),
  });
  let data;
  try {
    data = await resp.json();
  } catch {
    throw new Error(`translate HTTP ${resp.status}`);
  }
  if (!resp.ok || (data && data.error)) {
    throw new Error((data && data.error) || `translate HTTP ${resp.status}`);
  }
  return data;
}

/**
 * 翻译文章/问题（标题 + 正文）。两请求并行发出；空标题/空正文跳过请求。
 * srcLang 仅为接口兼容保留 —— 服务端根据原文自动识别源语言（target 必传）。
 */
export async function translateArticle({ title, content, target }) {
  const [titleRes, contentRes] = await Promise.all([
    title ? postTranslate(title, target) : Promise.resolve({ translation: '' }),
    content ? postTranslate(content, target) : Promise.resolve({ translation: '' }),
  ]);
  return {
    title: titleRes.translation || '',
    content: contentRes.translation || '',
    translated: true,
    mt: true,
    relayed: false, // LLM 直译，无英语中转
  };
}

/**
 * 模型是否在浏览器侧已缓存 —— 服务端架构下恒为 true（无浏览器侧模型）。
 * 保留导出仅为兼容旧调用方；新代码不应再依赖它。
 */
export async function isModelCached() {
  return true;
}
