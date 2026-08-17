// 浏览器端机器翻译缓存层。
//
// IndexedDB（库 openshsid-mt / store translations）作持久层，内存 LRU（Map，
// 100 条）作前置层——命中即免去 IndexedDB 读放大。
//
// 缓存键（load-bearing，todo 4 引擎与 todo 6 MtTranslateBar 依赖此格式）：
//   `v1|${srcLang}>${target}|${modelRev}|${sha256(originalText)}`
//   - modelRev 由调用方从 todo 2 注册表 MT_MODELS[key].revision 传入；本模块
//     不 import models.js，保持单向依赖（models.js ← engine ← 此处）。
//   - title 与 content 由调用方分别作为 originalText 传入 → 分别哈希、分别缓存。
//
// 优雅降级：
//   - crypto.subtle 不可用（非安全上下文，部分 Cordova/Electron http 源）
//     → 降级为 djb2 哈希（见 djb2 注释）。
//   - indexedDB 不可用（隐私模式/老浏览器）→ getCached 返回 null、setCached 的
//     IDB 写入跳过；LRU 仍在内存中工作；调用方每次现翻不崩。
//
// 禁止：本模块不向任何后端 POST 译文；缓存纯浏览器侧（plan todo 5 约束）。

const DB_NAME = 'openshsid-mt';
const STORE_NAME = 'translations';
const LRU_MAX = 100;

// IDB 可用性：null=未探测，true/false=已探测。
let idbAvailable = null;
let idbUnavailableWarned = false;
let dbPromise = null;

// 内存 LRU：Map 保持插入顺序；set 后若超 100 删最老（首个 key）。
const lru = new Map();

function evictLru() {
  if (lru.size > LRU_MAX) {
    const oldest = lru.keys().next().value;
    if (oldest !== undefined) lru.delete(oldest);
  }
}

// djb2 哈希：crypto.subtle 不可用时的降级方案。
// 碰撞概率比 SHA-256 高，但键仍可用——前缀 v1|srcLang>target|modelRev 已大幅
// 缩小碰撞域（同模型版本 + 同语言对的条目才可能碰撞）。注释保留以备审计。
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i); // h * 33 + c
    h = h >>> 0; // 强制无符号 32-bit，避免符号位导致的负数 hex。
  }
  return h.toString(16);
}

function bufToHex(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

// 构造缓存键。SHA-256(originalText) → hex；crypto.subtle 不可用则降级 djb2。
// 所有参数接受任意类型（含 null）——统一 String() 强转，绝不抛异常。
export async function makeCacheKey(srcLang, target, modelRev, originalText) {
  const text = originalText == null ? '' : String(originalText);
  const src = srcLang == null ? '' : String(srcLang);
  const tgt = target == null ? '' : String(target);
  const rev = modelRev == null ? '' : String(modelRev);
  const subtle = typeof crypto !== 'undefined' && crypto && crypto.subtle;
  let hash;
  if (subtle && typeof subtle.digest === 'function') {
    try {
      const data = new TextEncoder().encode(text);
      const buf = await subtle.digest('SHA-256', data);
      hash = bufToHex(buf);
    } catch {
      // 极少见（subtle 存在但 digest 抛错）——降级 djb2。
      hash = djb2(text);
    }
  } else {
    // 非安全上下文（http:// 非 localhost）下 crypto.subtle 常为 undefined。
    hash = djb2(text);
  }
  return `v1|${src}>${tgt}|${rev}|${hash}`;
}

// 探测并打开 IndexedDB。失败返回 null 并（首次）warn。反复调用复用同一 Promise。
// IDB 不可用则后续直接返回 null（idbAvailable=false 短路）。
function openDb() {
  if (idbAvailable === false) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      idbAvailable = false;
      if (!idbUnavailableWarned) {
        console.warn('[mt/store] IndexedDB unavailable — cache disabled (in-memory LRU still active)');
        idbUnavailableWarned = true;
      }
      resolve(null);
      return;
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch {
      idbAvailable = false;
      if (!idbUnavailableWarned) {
        console.warn('[mt/store] indexedDB.open threw — cache disabled');
        idbUnavailableWarned = true;
      }
      resolve(null);
      return;
    }
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // key 由外键传入（完整缓存键），无 keyPath。
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (ev) => {
      idbAvailable = true;
      resolve(ev.target.result);
    };
    req.onerror = () => {
      idbAvailable = false;
      if (!idbUnavailableWarned) {
        console.warn('[mt/store] indexedDB.open error — cache disabled');
        idbUnavailableWarned = true;
      }
      resolve(null);
    };
  });
  return dbPromise;
}

// 查缓存：LRU 命中即返回；否则查 IndexedDB，命中后回填 LRU。
// key 为 null/未命中/IDB 不可用 → 一律返回 null（调用方现翻，不崩）。
export async function getCached(key) {
  if (key == null) return null;
  const k = String(key);
  if (lru.has(k)) return lru.get(k);
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const os = tx.objectStore(STORE_NAME);
      const req = os.get(k);
      req.onsuccess = () => {
        const v = req.result;
        if (v && typeof v === 'object' && typeof v.out === 'string') {
          lru.set(k, v.out);
          evictLru();
          resolve(v.out);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      // 事务级失败（如 db 已关闭）—— 缓存 best-effort，返回 null。
      resolve(null);
    }
  });
}

// 写缓存：同步写 LRU；异步写 IndexedDB（fire-and-forget，调用方可不 await）。
// key 或 out 为 null/undefined → no-op。IDB 不可用 → 仅 LRU 生效。
export function setCached(key, out) {
  if (key == null || out == null) return Promise.resolve();
  const k = String(key);
  const o = String(out);
  lru.set(k, o);
  evictLru();
  return openDb().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ out: o, ts: Date.now() }, k);
    } catch {
      // 事务级失败——静默忽略（缓存 best-effort）。
    }
  });
}
