// frontend/src/mt/worker.js
//
// OPUS-MT inference worker. Runs transformers.js `pipeline('translation', ...)`
// off the main thread so model download / WASM inference never blocks the UI.
//
// Message protocol (main thread -> worker):
//   { type: 'load',    chain: ['zh-en','en-jap',...], target: 'ja' }
//     Preload every model in `chain` (optional optimisation; the pipeline
//     otherwise lazy-loads on the first 'translate'). `chain` is a list of
//     hop descriptors as produced by resolveChain() — each is either
//     '<modelKey>' or '<modelKey>:<prefix>'. No response is sent.
//   { type: 'translate', id: <number>, segments: ['...', ...],
//     srcLang: 'zh', target: 'ja' }
//     Translate pre-segmented texts through the resolved hop chain.
//
// Message protocol (worker -> main thread):
//   { type: 'progress', id, file, progress }   progress in 0..100
//   { type: 'result',   id, output: '...' }      final joined translation
//   { type: 'error',    id, message: '...' }     on any failure
//
// Progress normalisation (OPUS-MT convention): transformers.js's
// progress_callback may emit `progress` as a fraction (0..1) OR already a
// percent (0..100). We coerce to percent: `raw <= 1 ? raw * 100 : raw`.
//
// Segments are joined with '' (empty string) per L3.6 — the separators live
// INSIDE the segments (segment(t,lang).join('') === t), so adding any join
// separator here would corrupt the reconstruction. PUA placeholders
// (\uE000<id>\uE001) from protect.js survive the model round-trip verbatim
// and are unwrapped by restore() on the main thread.

import { pipeline, env } from '@huggingface/transformers';
import { resolveChain, MT_MODELS } from './models.js';

// --- env configuration (worker startup) -------------------------------------
//
// ModelScope direct-link form. We default the remote host to ModelScope
// (https://modelscope.cn/models) and use the /resolve/master/ path template
// — the /resolve/ endpoints have CORS open (HF forum 169364 / ModelScope
// issue #1395), unlike the api/v1/.../repo?FilePath= form which lacks CORS.
// The base URL can be overridden via VITE_MT_MODEL_BASE for self-hosted
// mirrors / staging.
//
// remotePathTemplate: transformers.js v3.8.1 valid placeholders are
// {model} and {revision} ONLY — {file} is NOT a placeholder. The FILENAME
// is appended by transformers.js AFTER the template (with a '/' separator),
// so the template MUST end with a trailing '/' and MUST NOT contain {file}.
// (A '{model}/resolve/master/{file}' template would produce literal
// `.../master/{file}/tokenizer.json` URLs that 404. See Task 11 G2 evidence.)
const _mtBase = new URL(
  import.meta.env.VITE_MT_MODEL_BASE || 'https://modelscope.cn/models',
);
env.remoteHost = _mtBase.origin;
env.remotePathTemplate = `${_mtBase.pathname.replace(/^\/+|\/$/g, '')}/{model}/resolve/master/`;
// Cordova/Electron packaged apps have no model files on the local FS — never
// attempt filesystem loads, always fetch from the remote host.
env.allowLocalModels = false;
// Cache API for model weights/config (default true; explicit for clarity).
env.useBrowserCache = true;

// Single-threaded WASM fallback when the page is NOT cross-origin isolated.
// onnxruntime-web's multi-threaded WASM requires SharedArrayBuffer, which in
// turn requires COOP/COEP headers. Cordova WebViews, Electron builds without
// those headers, and most dev servers do NOT set them — so we pin numThreads
// to 1 there. Slower, but works everywhere. When cross-origin isolation IS
// active, leave numThreads at its default (multi-threaded) for speed.
if (self.crossOriginIsolated !== true) {
  env.backends.onnx.wasm.numThreads = 1;
}

// --- pipeline memoisation ---------------------------------------------------
//
// Pipeline instances are memoised by modelKey: a chain like
// ['zh-en', 'en-jap'] reuses the zh-en pipeline for the second hop of a
// subsequent segment, and a later translate() call reuses both. We store
// the Promise (not the resolved instance) so a concurrent translate() that
// arrives while the first download is in-flight awaits the same download
// rather than kicking off a duplicate.
const pipelines = new Map(); // modelKey -> Promise<pipeline>

function getPipeline(modelKey, progress_callback) {
  if (pipelines.has(modelKey)) return pipelines.get(modelKey);
  const modelId = MT_MODELS[modelKey].id;
  const promise = pipeline('translation', modelId, { progress_callback });
  pipelines.set(modelKey, promise);
  return promise;
}

// --- helpers ----------------------------------------------------------------

// Normalise a raw progress value to 0..100. transformers.js may emit a
// fraction (<=1) or already a percent (>1); handle both. Non-numeric /
// non-finite values collapse to 0 (the UI treats progress=0 as "starting").
function normalizeProgress(raw) {
  if (typeof raw !== 'number' || !isFinite(raw)) return 0;
  return raw <= 1 ? raw * 100 : raw;
}

// Parse a hop descriptor into { modelKey, prefix }.
// Split on the FIRST colon (L2.1): left = modelKey, right (if present) = a
// literal prefix to prepend to the input text (e.g. '>>kor<<'). Using
// indexOf + slice (not String.split) keeps this safe if a future prefix ever
// contains a colon. OPUS-MT prefixes (>>xx<<) never do today.
function parseHop(descriptor) {
  const idx = descriptor.indexOf(':');
  if (idx === -1) return { modelKey: descriptor, prefix: '' };
  return { modelKey: descriptor.slice(0, idx), prefix: descriptor.slice(idx + 1) };
}

// Emit a progress message for a given request id. Called from the
// progress_callback we hand to pipeline(). `file` is the model file being
// fetched (e.g. 'model.onnx'); fall back to the modelKey so the UI has
// *something* to label the bar.
function emitProgress(id, modelKey, data) {
  if (!data || data.progress === undefined) return;
  postMessage({
    type: 'progress',
    id,
    file: data.file || modelKey,
    progress: normalizeProgress(data.progress),
  });
}

// --- core: translate a segment array through the hop chain ------------------
//
// For each segment, run it through every hop in order. The output of hop N
// is the input to hop N+1. If a hop has a prefix (e.g. '>>kor<<' for en-mul
// targeting Korean), prepend it to the text before calling the translator.
// After all hops for all segments, join with '' (L3.6).
async function translateChain(segments, srcLang, target, id) {
  const chain = resolveChain(srcLang, target);
  if (!chain) {
    postMessage({
      type: 'error',
      id,
      message: `unsupported pair: ${srcLang}->${target}`,
    });
    return null;
  }

  const out = [];
  for (const seg of segments) {
    let text = seg;
    for (const descriptor of chain) {
      const { modelKey, prefix } = parseHop(descriptor);
      // Hops are sequential by design (hop N's output feeds hop N+1).
      const translator = await getPipeline(modelKey, (data) => emitProgress(id, modelKey, data));
      const input = prefix ? prefix + text : text;
      const result = await translator(input, {
        max_new_tokens: 256,
        return_full_text: false,
      });
      // Result field convention: prefer translation_text, fall back to generated_text.
      text = result[0].translation_text ?? result[0].generated_text;
    }
    out.push(text);
  }
  // L3.6: separators are inside segments; join with '' (not '\n' or ' ').
  return out.join('');
}

// --- message handler --------------------------------------------------------
//
// Wrap the whole dispatch in try/catch so any throw becomes a structured
// { type: 'error', id, message } rather than an unhandled worker exception
// (which surfaces as a bare `error` event on the main thread with no id).
self.onmessage = async (e) => {
  const data = e && e.data;
  if (!data || typeof data !== 'object') return;
  const { type, id } = data;
  try {
    if (type === 'load') {
      // Preload every model in the provided chain. No response is sent; the
      // caller may listen for progress messages with the id it passed (or
      // undefined if none) to track the download. This is purely an
      // optimisation — translate() will lazy-load on first use anyway.
      const chain = Array.isArray(data.chain) ? data.chain : null;
      if (!chain) return;
      for (const descriptor of chain) {
        const { modelKey } = parseHop(descriptor);
        if (!MT_MODELS[modelKey]) continue;
        // Preloads are sequential — each must finish before the next starts.
        await getPipeline(modelKey, (p) => emitProgress(id, modelKey, p));
      }
      return;
    }
    if (type === 'translate') {
      const { segments, srcLang, target } = data;
      if (!Array.isArray(segments)) {
        postMessage({ type: 'error', id, message: 'segments must be an array' });
        return;
      }
      const joined = await translateChain(segments, srcLang, target, id);
      if (joined === null) return; // unsupported pair already posted an error
      postMessage({ type: 'result', id, output: joined });
      return;
    }
    // Unknown message type: ignore silently (forward-compat).
  } catch (err) {
    postMessage({
      type: 'error',
      id,
      message: String((err && err.message) || err),
    });
  }
};
