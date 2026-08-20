import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '../context/useLang';
import { onPwaEvent, applyPwaUpdate, initPwa } from '../pwa';

// 新版本可用 / 离线可用 提示条。initPwa() 只在支持 SW 的构建里生效
// （electron 渲染进程没有配置 vite-plugin-pwa，virtual 模块不存在，
// 因此这个组件与 pwa.js 都只属于 web 前端，不需要同步到 electron/renderer）。
export default function PwaUpdateToast() {
  const { t } = useLang();
  const [state, setState] = useState(null); // null | 'needRefresh' | 'offlineReady'

  useEffect(() => {
    initPwa();
    return onPwaEvent(setState);
  }, []);

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-gray-200/80 dark:border-gray-700/80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-xl px-4 py-2.5"
        >
          <i className={`bi ${state === 'needRefresh' ? 'bi-arrow-repeat' : 'bi-check-circle'} text-indigo-500`} />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {state === 'needRefresh' ? t('pwa.updateAvailable') : t('pwa.offlineReady')}
          </span>
          {state === 'needRefresh' && (
            <button
              onClick={applyPwaUpdate}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('pwa.reload')}
            </button>
          )}
          <button
            onClick={() => setState(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title={t('about.close')}
          >
            <i className="bi bi-x-lg text-xs" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
