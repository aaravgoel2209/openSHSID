import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { PlusIcon } from '@heroicons/react/24/outline';
import { getConversations, searchUsers, sendMessage } from '../api/chat';
import { AuthContext } from '../context/AuthContext';

export default function ChatList() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [newContent, setNewContent] = useState('');
  const [sending, setSending] = useState(false);

  const fetch = () => {
    if (!user) return;
    setLoading(true);
    getConversations().then(setConversations).finally(() => setLoading(false));
  };

  useEffect(fetch, [user]);

  useEffect(() => {
    if (search.length < 1) { setResults([]); return; }
    const timer = setTimeout(() => {
      searchUsers(search).then(setResults);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const handleStartChat = async (u) => {
    if (!newContent.trim()) return;
    setSending(true);
    try {
      await sendMessage(u.id, newContent);
      setShowNew(false);
      setSearch('');
      setNewContent('');
      navigate(`/chat/${u.id}`);
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-yellow-700 dark:text-yellow-300">
        请先登录后使用私信。
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">私信</h1>
        <Button color="primary" variant="flat" size="sm" onPress={() => setShowNew(!showNew)}>
          <PlusIcon className="w-5 h-5" />
          新对话
        </Button>
      </div>

      {showNew && (
        <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-gray-900 rounded-xl p-4 mb-4 space-y-3">
          <input
            className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-950 text-sm dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="搜索用户..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {results.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-900 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
              {results.map((u) => (
                <div key={u.id} className="p-3 space-y-2">
                  <p className="text-sm font-medium">{u.username}</p>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-950 text-sm dark:text-gray-300"
                      placeholder="发一条消息..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                    />
                    <Button size="sm" color="primary" onPress={() => handleStartChat(u)} isLoading={sending}>
                      发送
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {search && results.length === 0 && (
            <p className="text-sm text-gray-500">未找到用户。</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : conversations.length === 0 ? (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-blue-700 dark:text-blue-300">
          还没有对话，点击右上角"新对话"开始聊天。
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <div
              key={c.user_id}
              className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-gray-900 rounded-lg p-4 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 transition-all"
              onClick={() => navigate(`/chat/${c.user_id}`)}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold">{c.username}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {c.last_message_at?.slice(0, 16).replace('T', ' ')}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{c.last_message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
