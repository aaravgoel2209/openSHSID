import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// 全局轻量级通知（右上角弹出、自动消失）。用法：
//   const { showToast } = useToast();
//   showToast({ message: '文章已发布', type: 'success', action: { label: '查看', onPress: () => nav(url) } });
const ToastContext = createContext({ showToast: () => {} });

const ICONS = {
  success: 'bi-check-circle-fill text-emerald-500',
  info: 'bi-info-circle-fill text-indigo-500',
  error: 'bi-exclamation-circle-fill text-rose-500',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ message, type = 'success', action, duration = 4000 }) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type, action }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      {/* 右上角通知栈（顶栏之上，固定定位） */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="pointer-events-auto flex items-center gap-3 min-w-[240px] max-w-[360px] rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-lg px-4 py-3"
            >
              <i className={`bi ${ICONS[t.type] || ICONS.info} text-lg shrink-0`} />
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 break-words">{t.message}</span>
              {t.action && (
                <button
                  onClick={() => { t.action.onPress?.(); dismiss(t.id); }}
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0"
                aria-label="close"
              >
                <i className="bi bi-x-lg text-xs" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
