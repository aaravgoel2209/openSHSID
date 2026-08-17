// Text protection, segmentation, and source-language detection for browser-side MT.
//
// Reference: model/app.py:441-470 (_protect_math/_restore_math) wraps protected
// spans in Private-Use Area (PUA) Unicode characters so the translation model
// preserves them verbatim. We adopt the same PUA convention with explicit
// delimiters: each protected span becomes
//     \uE000<id>\uE001
// where <id> is the 0-based index into the store array. U+E000 / U+E001 live in
// the BMP Private-Use Area (U+E000..U+F8FF) and are not translated by OPUS-MT.
//
// Limitation (shared with the backend): if the source text itself contains
// literal U+E000 / U+E001 characters, restore may misread them as placeholders.
// PUA chars do not occur in normal prose, so this is acceptable.

// Protection patterns, applied in priority order (highest first). Order matters:
// fenced code before inline code before $$...$$ before $...$ so the outermost
// construct is masked first and inner markers are never double-matched.
const PATTERNS = [
  // 1. Fenced code blocks: ```...``` (multi-line; language tag sits inside).
  /```[\s\S]*?```/g,
  // 2. Inline code: `...` (single backtick, single line).
  /`[^`\n]+?`/g,
  // 3. LaTeX display math: $$...$$
  /\$\$[\s\S]+?\$\$/g,
  // 4. LaTeX bracket display: \[...\]
  /\\\[[\s\S]+?\\\]/g,
  // 5. LaTeX inline: \(...\)
  /\\\([\s\S]+?\\\)/g,
  // 6. LaTeX environment: \begin{env}...\end{env}
  /\\begin\{[a-zA-Z*]+\}[\s\S]+?\\end\{[a-zA-Z*]+\}/g,
  // 7. LaTeX inline math: $...$ (single $, NOT $$). [^\n$] excludes $ from the
  //    content so a surviving $$ cannot match here; combined with the $$...$$
  //    pass running earlier, $...$ never collides with $$...$$. (?!\s) /
  //    (?<!\s) reject leading/trailing whitespace so casual dollar signs
  //    ("I have $5 and $3.") are not misread as math.
  /\$(?!\s)[^\n$]+?(?<!\s)\$/g,
  // 8. URLs: http(s)://... up to the next whitespace.
  /https?:\/\/[^\s]+/g,
];

/**
 * Replace protected spans (code, LaTeX, URLs) with PUA placeholders.
 *
 * @param {string} text Source text.
 * @returns {{ masked: string, store: string[] }} `masked` is `text` with every
 *   protected span replaced by `\uE000<id>\uE001`; `store[id]` holds the
 *   original span. restore(masked, store) reproduces `text` exactly.
 */
export function protect(text) {
  if (text == null) return { masked: '', store: [] };
  let s = String(text);
  const store = [];
  for (const pattern of PATTERNS) {
    s = s.replace(pattern, (match) => {
      const id = store.length;
      store.push(match);
      return '\uE000' + id + '\uE001';
    });
  }
  return { masked: s, store };
}

/**
 * Restore the original spans into a (possibly translated) string.
 *
 * Placeholders are resolved highest-id first so nested protection (a
 * lower-priority span wrapping a higher-priority span's placeholder) unwraps
 * correctly in a single decreasing sweep without re-scanning replacements.
 *
 * @param {string} text Text containing `\uE000<id>\uE001` placeholders.
 * @param {string[]} store The store returned by protect.
 * @returns {string} `text` with placeholders swapped for their originals.
 *   Unresolved placeholders (stale/empty store) are left in place; never throws.
 */
export function restore(text, store) {
  if (text == null) return '';
  let s = String(text);
  if (!store || !store.length) return s;
  for (let id = store.length - 1; id >= 0; id--) {
    const original = store[id];
    if (original == null) continue;
    s = s.split('\uE000' + id + '\uE001').join(String(original));
  }
  return s;
}

// Per-language segment character caps. OPUS-MT accepts <= 512 tokens; without a
// tokenizer we use conservative char heuristics: CJK / Hangul / Kana ~ 1
// token/char, Latin ~ 0.3 token/char. The caps stay safely under 512 tokens.
const SEG_CAPS = { zh: 350, ja: 350, ko: 350, en: 1200 };

/**
 * Split already-protected (masked) text into segments each within the token
 * budget. Split priority: paragraph boundary (\n\n) -> sentence boundary
 * (。！？!?. and newline) -> hard char cut. A placeholder is never split: if a
 * cut would land inside a \uE000...\uE001 placeholder, the cut moves to before
 * the placeholder.
 *
 * Contract for the MT engine (todo 4): `segment(t, lang).join('') === t` for
 * every non-empty `t` -- concatenating translated segments reconstructs the
 * protected text (separators are preserved, never discarded).
 *
 * @param {string} masked Protected text (output of protect().masked).
 * @param {string} srcLang Source language code (zh/ja/ko/en).
 * @returns {string[]} Segments. Empty/null input -> [].
 */
export function segment(masked, srcLang) {
  if (masked == null) return [];
  const s = String(masked);
  if (s === '') return [];
  const cap = SEG_CAPS[srcLang] || 1200;
  if (s.length <= cap) return [s];
  return packParagraphs(s, cap);
}

// Split into paragraphs at \n\n boundaries, keeping the separator attached to
// the preceding paragraph so segments.join('') === input.
function splitParagraphs(text) {
  const parts = text.split(/(\n\n+)/);
  const paragraphs = [];
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i] || '';
    const sep = parts[i + 1] || '';
    paragraphs.push(body + sep);
  }
  return paragraphs;
}

// Split a paragraph into sentence units at 。！？!?. and \n boundaries, keeping
// the boundary character with the preceding sentence.
function splitSentences(text) {
  const units = [];
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    buf += text[i];
    if ('。！？!?.\n'.indexOf(text[i]) !== -1) {
      units.push(buf);
      buf = '';
    }
  }
  if (buf.length > 0) units.push(buf);
  return units;
}

// If `pos` falls inside a \uE000...\uE001 placeholder, return the index of the
// opening \uE000 (move the cut to before the placeholder); otherwise return pos.
function safeCut(text, pos) {
  if (pos <= 0 || pos >= text.length) return pos;
  const open = text.lastIndexOf('\uE000', pos - 1);
  if (open === -1) return pos;
  const close = text.indexOf('\uE001', open + 1);
  if (close !== -1 && close >= pos) return open; // pos is inside [open, close]
  return pos;
}

// Hard-cut a single unit that still exceeds the cap by characters, never
// splitting a placeholder.
function hardCut(text, cap, out) {
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + cap, text.length);
    if (end < text.length) {
      const safe = safeCut(text, end);
      end = (safe > i) ? safe : Math.min(i + cap, text.length);
    }
    out.push(text.slice(i, end));
    i = end;
  }
}

// Greedily pack sentence units into segments <= cap; hard-cut any single unit
// longer than cap.
function packUnits(units, cap, out) {
  let cur = '';
  for (const unit of units) {
    if (unit.length > cap) {
      if (cur.length > 0) { out.push(cur); cur = ''; }
      hardCut(unit, cap, out);
    } else if (cur.length + unit.length <= cap) {
      cur += unit;
    } else {
      out.push(cur);
      cur = unit;
    }
  }
  if (cur.length > 0) out.push(cur);
}

function packParagraphs(text, cap) {
  const out = [];
  for (const para of splitParagraphs(text)) {
    if (para.length === 0) continue;
    if (para.length <= cap) {
      out.push(para);
    } else {
      packUnits(splitSentences(para), cap, out);
    }
  }
  return out;
}

/**
 * Lightweight source-language heuristic. No language-detection library (the
 * plan forbids franc / cld3); this is a deterministic script-ratio check.
 *
 * Order and thresholds:
 *   1. Hangul (U+AC00-D7AF, U+1100-11FF, U+3130-318F) is the most frequent
 *      among the Asian scripts (Hangul >= Kana and Hangul >= CJK) -> 'ko'.
 *   2. Kana (U+3040-30FF) is present and not fewer than Hangul -> 'ja'.
 *   3. CJK ideographs (U+4E00-9FFF) >= ASCII letters -> 'zh' (matches the
 *      backend heuristic in OpenSHSID_backend/translation.py:22-28).
 *   4. Otherwise -> 'en'. Empty / null -> 'en' (safe default).
 *
 * @param {string} text Source text.
 * @returns {'zh'|'en'|'ja'|'ko'} Detected language code.
 */
export function detectSourceLang(text) {
  if (!text) return 'en';
  const s = String(text);
  let h = 0;
  let k = 0;
  let c = 0;
  let a = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF) || (code >= 0x3130 && code <= 0x318F)) {
      h++;
    } else if (code >= 0x3040 && code <= 0x30FF) {
      k++;
    } else if (code >= 0x4E00 && code <= 0x9FFF) {
      c++;
    } else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) {
      a++;
    }
  }
  if (h > 0 && h >= k && h >= c) return 'ko';
  if (k > 0 && k >= h) return 'ja';
  if (c >= a) return 'zh';
  return 'en';
}
