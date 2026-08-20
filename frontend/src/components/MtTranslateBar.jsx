// frontend/src/components/MtTranslateBar.jsx
//
// 紧凑工具条：把当前文章/问题内容翻译成用户所选目标语言（当前 UI 提供日语）。
// 翻译在服务端完成：engine.js POST Flask 模型服务 /translate（与 Rei 同一 LLM），
// 无模型下载、无浏览器缓存；仿 ArticleDetail.jsx:143-151 现有译文徽标行样式
// （text-xs text-gray-400、bi bi-translate、indigo hover:underline 按钮）。
//
// Props 契约（供 ArticleDetail / QuestionDetail 集成）：
//   title       : string | null  —— 文章/问题标题（原样传给 engine）。
//   content     : string | null  —— 正文 markdown（原样传给 engine）。
//   sourceLang  : string | null  —— 源语言码提示（透传给 engine；服务端按原文自动识别）。
//   onTranslated: (result|null) => void
//     翻译成功时收到 engine.js 的返回形状：
//       { title, content, translated: true, mt: true, relayed: false }
//     用户在「查看原文 / 查看译文」之间切换时：
//       切到「查看原文」 -> onTranslated(null)          （父级回退到 loc / 原文）
//       切到「查看译文」 -> onTranslated(result)        （父级显示 MT 译文）
//     请求报错时 engine 抛出 -> 本组件捕获并显示 t('mt.failed')，不调 onTranslated。
//
// 父级建议用法：onTranslated={setMtResult}（需为稳定引用），渲染侧
//   `mtResult && !showOriginal ? mtResult : loc`
// （父级自身的 showOriginal 控制原文与 loc/MT 之间的切换；本组件的 toggle 通过
//   onTranslated(null|result) 控制 mtResult，二者分层不冲突。）

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../context/useLang';
import { translateArticle } from '../mt/engine.js';
import { MT_TARGETS } from '../mt/models.js';

// 目标语言选项（从 models.js 的 MT_TARGETS 派生，确保 labelKey 与 i18n 键一致）。
const TARGET_CODES = Object.keys(MT_TARGETS); // ['ja']

export default function MtTranslateBar({ title, content, sourceLang, onTranslated }) {
  const { t } = useLang();

  // 目标语言：localStorage 记忆，默认 ja。
  const [target, setTarget] = useState(() => {
    const saved = localStorage.getItem('mt_target');
    return saved && MT_TARGETS[saved] ? saved : 'ja';
  });

  // 状态机：idle -> translating -> done | error | unsupported
  // （server-side 单发请求：不再有模型下载的 loading 阶段；unsupported 保留给
  //  engine 未来可能返回的形状，当前 LLM 路径不会触发）。
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  // done 态下「查看原文 / 查看译文」的内部切换状态。
  const [showOriginal, setShowOriginal] = useState(false);

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
    setErrorMsg(null);
    setShowOriginal(false);
  }

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

  const handleTranslate = useCallback(async () => {
    // 服务端 LLM 单发翻译：无数值进度，直接进 translating 态（显示「翻译中…」）。
    setStatus('translating');
    setErrorMsg(null);
    setResult(null);
    setShowOriginal(false);
    try {
      const res = await translateArticle({
        title,
        content,
        srcLang: sourceLang,
        target,
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
      setErrorMsg((e && e.message) || 'fetch error');
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
  const controlDisabled = busy || status === 'unsupported';

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

      {/* 进行中（server-side 单发，无数值进度） */}
      {busy && <span>{t('mt.translating')} …</span>}

      {/* 失败信息 */}
      {status === 'error' && (
        <span className="text-red-500">
          {t('mt.failed')}
          {errorMsg ? `: ${errorMsg}` : ''}
        </span>
      )}

      {/* 不支持 */}
      {status === 'unsupported' && (
        <span>{t('mt.unsupported')}</span>
      )}

      {/* 成功：绿色提示 + 原文/译文切换 */}
      {status === 'done' && result && (
        <>
          <span className="text-emerald-500">{t('mt.doneNote')}</span>
          {result.relayed && <span className="text-amber-500">{t('mt.relayedNote')}</span>}
          <button onClick={handleToggle} className="text-indigo-500 hover:underline">
            {showOriginal ? t('common.showTranslation') : t('common.showOriginal')}
          </button>
        </>
      )}
    </div>
  );
}
