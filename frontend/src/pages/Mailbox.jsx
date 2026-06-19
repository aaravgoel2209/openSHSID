import { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { AuthContext } from '../context/AuthContext';
import {
  getNotifications, markNotificationRead,
  markAllNotificationsRead, clearNotifications,
} from '../api/notifications';

const TYPE_META = {
  answer: { icon: '💬', label: '回答' },
  reply: { icon: '↩️', label: '回复' },
  like: { icon: '👍', label: '点赞' },
  message: { icon: '✉️', label: '私信' },
  system: { icon: '🔔', label: '系统' },
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return iso.slice(0, 10);
}

export default function Mailbox() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getNotifications().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user]);

  const openItem = async (n) => {
    if (!n.is_read) {
      try { await markNotificationRead(n.id); } catch {}
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.link) navigate(n.link);
  };

  const handleReadAll = async () => {
    try { await markAllNotificationsRead(); } catch {}
    setItems((list) => list.map((x) => ({ ...x, is_read: true })));
  };

  const handleClear = async () => {
    if (!window.confirm('确认清空全部通知？')) return;
    try { await clearNotifications(); } catch {}
    setItems([]);
  };

  if (!user) {
    return (
      <div className="mt-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30 p-4 text-sm text-yellow-700 dark:text-yellow-300">
        请先<Link to="/login" className="font-semibold underline">登录</Link>后查看信箱。
      </div>
    );
  }

  const unread = items.filter((x) => !x.is_read).length;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">信箱</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {unread > 0 ? `${unread} 条未读` : '没有未读消息'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="flat" onPress={handleReadAll} isDisabled={unread === 0}>全部已读</Button>
          <Button size="sm" variant="light" className="text-rose-500" onPress={handleClear} isDisabled={items.length === 0}>清空</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-3xl">📭</div>
          <p className="text-gray-600 dark:text-gray-400">暂无通知</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.system;
            return (
              <div
                key={n.id}
                onClick={() => openItem(n)}
                className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  n.is_read
                    ? 'bg-white dark:bg-slate-900/50 border-gray-200/80 dark:border-slate-800/80 hover:border-indigo-200 dark:hover:border-indigo-800/60'
                    : 'bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/60 hover:border-indigo-300'
                }`}
              >
                <div className="text-xl shrink-0 mt-0.5">{meta.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${n.is_read ? 'text-gray-700 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-gray-100'}`}>
                      {n.title}
                    </p>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                  </div>
                  {n.message && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{n.message}</p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
