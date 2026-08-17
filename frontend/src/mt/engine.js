// frontend/src/mt/engine.js
//
// Main-thread facade for browser-side OPUS-MT translation. Owns one Web
// Worker (worker.js) and exposes a small async API:
//
//   translateArticle({ title, content, srcLang, target, onProgress })
//     -> { title, content, translated, mt, relayed, unsupported? }
//   isModelCached(target) -> boolean   (advisory; for UI hint only)
//
// Pipeline (per L3.6 / L3.8):
//   detectSourceLang ONCE (if srcLang not given) on raw title+\n+content
//   -> protect(title) / protect(content)
//   -> segment(masked, srcLang)
//   -> [cache check: getCached(key) for title & content]
//   -> worker.translate (titleSegs) + worker.translate (contentSegs)  [parallel]
//   -> join('') each
//   -> restore(translated, store)
//   -> setCached (fire-and-forget)
//
// Cache keys embed MT_MODELS[<first hop's modelKey>].revision so a model
// rev bump invalidates old entries (L5.1).
//
// Return shape (the contract for todo 6 / MtTranslateBar):
//   { title, content, translated: true,  mt: true, relayed: <bool|undefined> }
//   { title, content, translated: false, unsupported: true }   // no chain
// On a worker error translateArticle() throws — the caller (todo 6) is
// expected to catch and surface `t('mt.failed')`.

import { resolveChain, MT_MODELS, MT_TARGETS } from './models.js';
import { protect, segment, restore, detectSourceLang } from './protect.js';
import { makeCacheKey, getCached, setCached } from './store.js';

// --- worker wiring ----------------------------------------------------------

const worker = new Worker(new URL('./worker.js', import.meta.url), {
  type: 'module',
});

// Pending request table: id -> { resolve, reject, onProgress }.
// Capped by the worker's sequential throughput (one translate at a time
// today; the protocol allows concurrent in-flight requests if we later
// add a queue inside the worker).
const pending = new Map();
let nextId = 1;

worker.onmessage = (e) => {
  const data = e && e.data;
  if (!data || typeof data !== 'object') return;
  const req = pending.get(data.id);
  if (!req) return; // stale message for an already-settled/unknown id
  if (data.type === 'progress') {
    if (typeof req.onProgress === 'function') {
      req.onProgress(data.progress, data.file);
    }
  } else if (data.type === 'result') {
    pending.delete(data.id);
    req.resolve(data.output);
  } else if (data.type === 'error') {
    pending.delete(data.id);
    req.reject(new Error(data.message || 'worker error'));
  }
};

// Worker-level (unhandled) error: a crashed worker fails ALL in-flight
// requests. There's no per-request id on a bare `error` event, so we reject
// everything pending and let the caller retry / surface a failure.
worker.onerror = (e) => {
  const msg = (e && e.message) || 'worker crashed';
  for (const req of pending.values()) {
    req.reject(new Error(msg));
  }
  pending.clear();
};

// Send a translate request to the worker. Returns a promise that resolves
// with the joined translated string. `onProgress(progress, file)` is called
// for each download progress event (0..100, file label).
function sendTranslate(segments, srcLang, target, onProgress) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ type: 'translate', id, segments, srcLang, target });
  });
}

// --- helpers ----------------------------------------------------------------

// Derive the first hop's modelKey from a chain (for cache-key revision lookup).
// The first hop sets the model revision that scoped the translation; we key
// the cache on that. (If the chain's first hop ever changes model, the rev
// changes and entries invalidate — L5.1.)
function firstModelKeyOf(chain) {
  const first = chain[0];
  const idx = first.indexOf(':');
  return idx === -1 ? first : first.slice(0, idx);
}

// --- public API --------------------------------------------------------------

/**
 * Translate an article (title + content) from srcLang to target via the
 * browser-side OPUS-MT worker. Caches results in IndexedDB (store.js).
 *
 * @param {object}  args
 * @param {string}  args.title   Article title (may be empty/null).
 * @param {string}  args.content Article body (markdown; may be empty/null).
 * @param {string?} args.srcLang Source lang code ('zh'|'en'); if null/undef,
 *   detect ONCE from `title + '\n' + content` (L3.8). Unsupported detected
 *   langs (not in {zh,en}) short-circuit with `unsupported: true`.
 * @param {string}  args.target  Target lang code ('ja'|'ko').
 * @param {(progress:number,file:string):void} [args.onProgress]
 *   Progress callback for model download (0..100). Called for both the
 *   title and content request (whichever downloads first wins the bar).
 * @returns {Promise<{title:string,content:string,translated:boolean,
 *   mt?:boolean, relayed?:boolean, unsupported?:boolean}>}
 */
export async function translateArticle({ title, content, srcLang, target, onProgress }) {
  // 1. Detect source language ONCE on the raw text if not supplied (L3.8).
  let src = srcLang;
  if (src == null) {
    src = detectSourceLang(`${title || ''}\n${content || ''}`);
    if (src !== 'zh' && src !== 'en') {
      return { title: title || '', content: content || '', translated: false, unsupported: true };
    }
  }

  // Resolve the hop chain early so we can both (a) bail with `unsupported`
  // when the pair isn't wired and (b) derive the cache-key revision.
  const chain = resolveChain(src, target);
  if (!chain) {
    return { title: title || '', content: content || '', translated: false, unsupported: true };
  }

  // 2. Protect (mask code/LaTeX/URLs into PUA placeholders).
  const titleProt = protect(title);
  const contentProt = protect(content);

  // 3. Segment the masked text (separators stay INSIDE segments, L3.6).
  const titleSegs = segment(titleProt.masked, src);
  const contentSegs = segment(contentProt.masked, src);

  // 4. Build cache keys. `modelRev` comes from the first hop's model entry
  // (L5.1) so a model rev bump invalidates stale entries.
  const modelRev = MT_MODELS[firstModelKeyOf(chain)].revision;
  const [titleKey, contentKey] = await Promise.all([
    makeCacheKey(src, target, modelRev, title),
    makeCacheKey(src, target, modelRev, content),
  ]);
  const [cachedTitle, cachedContent] = await Promise.all([
    getCached(titleKey),
    getCached(contentKey),
  ]);

  // Fast path: both hit cache — return without a worker round-trip.
  if (cachedTitle != null && cachedContent != null) {
    return {
      title: cachedTitle,
      content: cachedContent,
      translated: true,
      mt: true,
      relayed: MT_TARGETS[target] && MT_TARGETS[target].relayed,
    };
  }

  // 5. Send two worker messages (title + content) in parallel. We use two
  //    separate requests rather than one combined so that an empty title
  //    (segments === []) skips a worker round-trip entirely — sending an
  //    empty segment array through the chain would still spin the hop loop
  //    (no-op, but wasteful). Progress from both requests funnels through
  //    the same `onProgress` callback (download progress is per-model, so
  //    the title and content requests share model weights — whichever
  //    downloads first reports progress, the second hits the memoised
  //    pipeline).
  const titlePromise =
    cachedTitle != null
      ? Promise.resolve(cachedTitle)
      : titleSegs.length > 0
        ? sendTranslate(titleSegs, src, target, onProgress)
        : Promise.resolve('');

  const contentPromise =
    cachedContent != null
      ? Promise.resolve(cachedContent)
      : contentSegs.length > 0
        ? sendTranslate(contentSegs, src, target, onProgress)
        : Promise.resolve('');

  const [titleResult, contentResult] = await Promise.all([
    titlePromise,
    contentPromise,
  ]);

  // 6. Restore PUA placeholders into the translated text.
  const titleRestored = restore(titleResult, titleProt.store);
  const contentRestored = restore(contentResult, contentProt.store);

  // 7. Cache the restored results (fire-and-forget — do NOT await in the
  //    hot path; the LRU is synchronous so the value is immediately
  //    retrievable via getCached on a repeat call). Only cache the entries
  //    that were misses (don't re-write cached values).
  if (cachedTitle == null) setCached(titleKey, titleRestored);
  if (cachedContent == null) setCached(contentKey, contentRestored);

  // 8. Return the final shape. `relayed` is undefined for non-relay targets
  //    (ja); truthy for ko (via en-mul). MtTranslateBar (todo 6) reads
  //    `relayed` to show the "may be less direct" note.
  return {
    title: titleRestored,
    content: contentRestored,
    translated: true,
    mt: true,
    relayed: MT_TARGETS[target] && MT_TARGETS[target].relayed,
  };
}

/**
 * Best-effort probe of whether the model(s) for `target` are already in the
 * browser's Cache API (i.e. previously downloaded by transformers.js's
 * `env.useBrowserCache`). Advisory ONLY — used by the UI to say "model
 * already downloaded" vs "will download ~35MB". This is a HINT, not
 * authoritative: the Cache API may have been evicted, or transformers.js may
 * store under a different cache key than the one we probe.
 *
 * Implementation: probe `config.json` for the first hop's model against the
 * resolved ModelScope URL via `caches.match(url)`. If the Cache API is
 * unavailable (older browser, non-secure context in some cases, node), return
 * false.
 *
 * @param {string} target Target lang code ('ja'|'ko').
 * @returns {Promise<boolean>}
 */
export async function isModelCached(target) {
  try {
    if (typeof caches === 'undefined' || typeof caches.match !== 'function') {
      return false;
    }
    // We don't know the source language at probe time; try zh first (the
    // dominant case for this site), fall back to en. If either chain's
    // first model is cached, we report a hit.
    const chain = resolveChain('zh', target) || resolveChain('en', target);
    if (!chain) return false;
    const model = MT_MODELS[firstModelKeyOf(chain)];
    if (!model) return false;
    const base = import.meta.env.VITE_MT_MODEL_BASE || 'https://modelscope.cn/models';
    const url = `${base}/${model.id}/resolve/master/config.json`;
    const cached = await caches.match(url);
    return !!cached;
  } catch {
    return false;
  }
}
