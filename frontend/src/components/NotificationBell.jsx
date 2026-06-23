import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BellIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import {
  getNotifications, getUnreadCount,
  markNotificationRead, markAllNotificationsRead,
} from '../api/notifications';

const TYPE_ICON = { answer: '💬', reply: '↩️', like: '👍', message: '✉️', system: '🔔' };

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return iso.slice(0, 10);
}

export default function NotificationBell() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  // 轮询未读数（登录时）
  useEffect(() => {
    if (!user) { setUnread(0); return; }
    const poll = () => getUnreadCount().then(setUnread).catch(() => {});
    poll();
    const t = setInterval(poll, 30000);
    const onFocus = () => poll();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [user]);

  // 点击外部 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      getNotifications().then((d) => setItems(Array.isArray(d) ? d.slice(0, 12) : [])).catch(() => {}).finally(() => setLoading(false));
    }
  };

  const openItem = async (n) => {
    if (!n.is_read) {
      try { await markNotificationRead(n.id); } catch {}
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    try { await markAllNotificationsRead(); } catch {}
    setItems((l) => l.map((x) => ({ ...x, is_read: true })));
    setUnread(0);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <motion.button whileTap={{ scale: 0.9 }} onClick={toggle} className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500" title="信箱">
        <BellIcon className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg z-50 overflow-hidden"
          >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">信箱</span>
            <button onClick={readAll} disabled={unread === 0}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-default">
              全部已读
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-xs text-gray-400">加载中...</div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">📭 暂无通知</div>
            ) : items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)}
                className={`w-full flex gap-2.5 px-4 py-2.5 text-left border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${n.is_read ? '' : 'bg-indigo-50/50 dark:bg-indigo-950/20'}`}>
                <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[n.type] || '🔔'}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs truncate ${n.is_read ? 'text-gray-700 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-gray-100'}`}>{n.title}</span>
                  {n.message && <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">{n.message}</span>}
                  <span className="block text-[10px] text-gray-400 mt-0.5">{timeAgo(n.created_at)}</span>
                </span>
                {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />}
              </button>
            ))}
          </div>

          <button onClick={() => { setOpen(false); navigate('/mailbox'); }}
            className="w-full text-center text-xs text-gray-500 dark:text-gray-400 py-2.5 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
            查看全部
          </button>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
