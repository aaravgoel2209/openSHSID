import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useLang } from '../context/LanguageContext';
import { FLASK_BASE } from '../config';

/* global __BUILD_INFO__ */
// 构建时由 vite.config.js 的 define 注入：commit 首行、短 hash、提交日期、构建时间
const BUILD = typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : {};

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{label}</span>
      <span className="text-xs text-gray-700 dark:text-gray-300 text-right break-all">{children}</span>
    </div>
  );
}

export default function AboutDialog({ open, onClose }) {
  const { lang, t } = useLang();
  const desktop = window.desktop;
  const [translationModel, setTranslationModel] = useState(null);

  // 每次打开时向 Flask 模型服务拉取模型列表（翻译与 Rei 同模型）。
  // 失败 / 无模型时静默隐藏该行；关闭时 abort 未完成的请求。
  useEffect(() => {
    if (!open) return undefined;
    const ctrl = new AbortController();
    // 异步清空上次的值（effect 体内不同步 setState），成功后由下方 then 覆写
    Promise.resolve().then(() => setTranslationModel(null));
    fetch(`${FLASK_BASE}/models`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        const ids = ((data && data.models) || []).map((m) => m && m.id).filter(Boolean);
        if (ids.length > 0) setTranslationModel(ids.join(', '));
      })
      .catch(() => { /* 模型服务不可用 /  abort 时静默：不渲染该行 */ });
    return () => ctrl.abort();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* 遮罩 */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ scale: 0.92, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative w-full max-w-sm rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-2xl p-6"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={t('about.close')}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>

            {/* 头部 */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/25">
                O
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100 leading-tight">openSHSID</p>
                <p className="text-xs text-gray-400">
                  {t('about.version')} {BUILD.version || '—'}
                  {desktop?.isElectron ? ' · Desktop' : ' · Web'}
                </p>
              </div>
            </div>

            {/* 版本信息 = 当前构建对应 commit 的首行 */}
            <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 px-3 py-2.5 mb-3">
              <p className="text-[10px] uppercase tracking-wide text-indigo-400 dark:text-indigo-500 mb-0.5">{t('about.buildInfo')}</p>
              <p className="text-sm text-indigo-900 dark:text-indigo-200 font-medium leading-snug">
                {BUILD.commit || t('about.unknown')}
              </p>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {(BUILD.hash || BUILD.date) && (
                <Row label={t('about.commit')}>
                  {BUILD.hash && <code className="font-mono">{BUILD.hash}</code>}
                  {BUILD.date && <span className="text-gray-400"> · {BUILD.date}</span>}
                </Row>
              )}
              {BUILD.builtAt && (
                <Row label={t('about.builtAt')}>
                  {new Date(BUILD.builtAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}
                </Row>
              )}
              <Row label={t('about.runtime')}>
                {desktop?.isElectron
                  ? `Electron ${desktop.versions?.electron} · Chrome ${desktop.versions?.chrome}`
                  : navigator.userAgent.match(/Chrome\/[\d.]+|Firefox\/[\d.]+|Safari\/[\d.]+/)?.[0] || 'Browser'}
              </Row>
              {/* 翻译模型（fetch 失败或无模型时不渲染该行） */}
              {translationModel && (
                <Row label={t('about.translationModel')}>
                  {translationModel}
                </Row>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
