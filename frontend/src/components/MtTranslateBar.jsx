// frontend/src/components/MtTranslateBar.jsx
//
// 紧凑工具条：在浏览器端把当前文章/问题内容翻译成日语或韩语（OPUS-MT）。
// 仿 ArticleDetail.jsx:143-151 现有译文徽标行样式（text-xs text-gray-400、
// bi bi-translate、indigo hover:underline 按钮）。
//
// Props 契约（供 todo 7 / todo 8 集成）：
//   title       : string | null  —— 文章/问题标题（原样传给 engine）。
//   content     : string | null  —— 正文 markdown（原样传给 engine）。
//   sourceLang  : string | null  —— 源语言码（'zh'|'en'）；null 则 engine 自行检测。
//   onTranslated: (result|null) => void
//     翻译成功时收到 engine.js 的返回形状：
//       { title, content, translated: true,  mt: true, relayed: <bool|undefined> }
//       { title, content, translated: false, unsupported: true }   // 无翻译链
//     用户在「查看原文 / 查看译文」之间切换时：
//       切到「查看原文」 -> onTranslated(null)          （父级回退到 loc / 原文）
//       切到「查看译文」 -> onTranslated(result)        （父级显示 MT 译文）
//     worker 报错时 engine 抛出 -> 本组件捕获并显示 t('mt.failed')，不调 onTranslated。
//
// 父级建议用法：onTranslated={setMtResult}（需为稳定引用），渲染侧
//   `mtResult && !showOriginal ? mtResult : loc`
// （父级自身的 showOriginal 控制原文与 loc/MT 之间的切换；本组件的 toggle 通过
//   onTranslated(null|result) 控制 mtResult，二者分层不冲突。）

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import { translateArticle, isModelCached } from '../mt/engine.js';
import { MT_TARGETS, MT_MODELS, resolveChain } from '../mt/models.js';

// 目标语言选项（从 models.js 的 MT_TARGETS 派生，确保 labelKey 与 i18n 键一致）。
const TARGET_CODES = Object.keys(MT_TARGETS); // ['ja','ko']

// 估算目标语言对应翻译链的总下载体量（MB），仅用于 idle 态给用户一个心理预期。
// 优先按 zh -> target 取链（本站主导场景），否则回退 en -> target。
function chainApproxMB(target) {
  const chain = resolveChain('zh', target) || resolveChain('en', target);
  if (!chain) return null;
  let total = 0;
  for (const hop of chain) {
    const colon = hop.indexOf(':');
    const key = colon === -1 ? hop : hop.slice(0, colon);
    const m = MT_MODELS[key];
    if (m && typeof m.approxMB === 'number') total += m.approxMB;
  }
  return total > 0 ? total : null;
}

// 源语言显式给到且不在 {zh,en} 白名单 -> 前端直接判定不支持（无需走 worker）。
function isUnsupportedSource(lang) {
  return lang != null && lang !== 'zh' && lang !== 'en';
}

export default function MtTranslateBar({ title, content, sourceLang, onTranslated }) {
  const { t } = useLang();

  // 目标语言：localStorage 记忆，默认 ja。
  const [target, setTarget] = useState(() => {
    const saved = localStorage.getItem('mt_target');
    return saved === 'ko' ? 'ko' : 'ja';
  });

  // 状态机：idle -> loading(模型下载中) -> translating(推理中) -> done | error | unsupported
  const [status, setStatus] = useState('idle');
  // progress: null = 不定（Content-Length 未暴露），或 0..100 数值。
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  // done 态下「查看原文 / 查看译文」的内部切换状态。
  const [showOriginal, setShowOriginal] = useState(false);
  // 模型缓存提示（advisory；isModelCached 返回 false 时为 false）。
  const [modelCachedHint, setModelCachedHint] = useState(false);

  // 用 ref 持有最新的 onTranslated，避免它出现在 effect/callback 依赖里导致
  // 重建/重跑（父级若传内联箭头会在每次 render 变化）。父级传 setMtResult 时
  // 本就是稳定引用，ref 是双保险。ref 在 effect 里更新（不在 render 里）。
  const onTranslatedRef = useRef(onTranslated);
  useEffect(() => {
    onTranslatedRef.current = onTranslated;
  }, [onTranslated]);

  // 目标语言变化时：在 render 阶段用「prevTarget」模式重置内部翻译状态
  // （React 推荐的「prop/state 变化时调整 state」写法，避免在 effect 里同步
  // setState 触发级联渲染）。旧译文对应另一个目标语言，继续展示会误导。
  const [prevTarget, setPrevTarget] = useState(target);
  if (target !== prevTarget) {
    setPrevTarget(target);
    setStatus('idle');
    setResult(null);
    setProgress(null);
    setErrorMsg(null);
    setShowOriginal(false);
    setModelCachedHint(false);
  }

  const upfrontUnsupported = isUnsupportedSource(sourceLang);

  // 持久化目标语言选择。
  useEffect(() => {
    localStorage.setItem('mt_target', target);
  }, [target]);

  // 目标语言变化时通知父级清掉旧 MT 结果（副作用，放 effect 里；读 ref 不读 prop）。
  useEffect(() => {
    if (typeof onTranslatedRef.current === 'function') {
      onTranslatedRef.current(null);
    }
  }, [target]);

  // 探测目标模型是否已缓存（advisory hint）。target 变化或挂载时跑一次。
  // 仅在 .then/.catch 异步回调里 setState（effect 体内不同步 setState）。
  useEffect(() => {
    let cancelled = false;
    isModelCached(target)
      .then((cached) => {
        if (!cancelled) setModelCachedHint(!!cached);
      })
      .catch(() => {
        if (!cancelled) setModelCachedHint(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  const handleTranslate = useCallback(async () => {
    // 前端预判不支持（源语言显式给到且非 zh/en）—— 直接显示 unsupported，不走 worker。
    if (isUnsupportedSource(sourceLang)) {
      setStatus('unsupported');
      return;
    }
    setStatus('loading');
    setProgress(null);
    setErrorMsg(null);
    setResult(null);
    setShowOriginal(false);
    try {
      const res = await translateArticle({
        title,
        content,
        srcLang: sourceLang,
        target,
        onProgress: (pct) => {
          if (typeof pct !== 'number') {
            setProgress(null);
            return;
          }
          if (pct >= 100) {
            // 模型下载完成 -> 进入推理阶段（推理无数值进度，显示不定指示）。
            setStatus('translating');
            setProgress(null);
          } else {
            setProgress(pct);
          }
        },
      });
      if (res && res.unsupported) {
        setStatus('unsupported');
        return;
      }
      setResult(res);
      setStatus('done');
      setShowOriginal(false);
      if (typeof onTranslatedRef.current === 'function') {
        onTranslatedRef.current(res);
      }
    } catch (e) {
      setErrorMsg((e && e.message) || 'worker error');
      setStatus('error');
    }
  }, [title, content, sourceLang, target]);

  const handleToggle = useCallback(() => {
    setShowOriginal((v) => {
      const next = !v;
      if (typeof onTranslatedRef.current === 'function') {
        onTranslatedRef.current(next ? null : result);
      }
      return next;
    });
  }, [result]);

  const busy = status === 'loading' || status === 'translating';
  const controlDisabled = busy || upfrontUnsupported || status === 'unsupported';
  const approxMB = chainApproxMB(target);

  return (
    <div className="flex items-center gap-2 mb-3 text-xs text-gray-400 flex-wrap">
      <i className="bi bi-translate" />

      {/* 目标语言下拉 */}
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        disabled={controlDisabled}
        aria-label={t('mt.translate')}
        className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {TARGET_CODES.map((code) => (
          <option key={code} value={code}>
            {t(MT_TARGETS[code].labelKey)}
          </option>
        ))}
      </select>

      {/* 翻译 / 重试按钮（error 态显示重试，其余态显示翻译） */}
      {status === 'error' ? (
        <button onClick={handleTranslate} className="text-indigo-500 hover:underline">
          {t('mt.retry')}
        </button>
      ) : (
        <button
          onClick={handleTranslate}
          disabled={controlDisabled}
          className={`text-indigo-500 hover:underline ${controlDisabled ? 'opacity-50 cursor-not-allowed no-underline' : ''}`}
        >
          {t('mt.translate')}
        </button>
      )}

      {/* 进度（下载 / 推理） */}
      {busy && (
        <span>
          {status === 'translating' ? t('mt.translating') : t('mt.downloading')}
          {progress != null ? ` ${Math.round(progress)}%` : ' …'}
        </span>
      )}

      {/* 失败信息 */}
      {status === 'error' && (
        <span className="text-red-500">
          {t('mt.failed')}
          {errorMsg ? `: ${errorMsg}` : ''}
        </span>
      )}

      {/* 不支持 */}
      {(status === 'unsupported' || upfrontUnsupported) && (
        <span>{t('mt.unsupported')}</span>
      )}

      {/* 成功：绿色提示 + 中转标注 + 原文/译文切换 */}
      {status === 'done' && result && (
        <>
          <span className="text-emerald-500">{t('mt.doneNote')}</span>
          {result.relayed && <span className="text-amber-500">{t('mt.relayedNote')}</span>}
          <button onClick={handleToggle} className="text-indigo-500 hover:underline">
            {showOriginal ? t('common.showTranslation') : t('common.showOriginal')}
          </button>
        </>
      )}

      {/* idle 态提示：未缓存则显示模型体量，已缓存则显示一个小绿勾 */}
      {status === 'idle' && !upfrontUnsupported && !modelCachedHint && approxMB && (
        <span className="text-gray-400">模型约 {approxMB}MB</span>
      )}
      {status === 'idle' && !upfrontUnsupported && modelCachedHint && (
        <span className="text-emerald-500" title={t('mt.doneNote')}>✓</span>
      )}
    </div>
  );
}
