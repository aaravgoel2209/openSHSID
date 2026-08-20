import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { PlusIcon, ChatBubbleLeftEllipsisIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { getConversations, searchUsers, sendMessage } from '../api/chat';
import { AuthContext } from '../context/authContext';

const AVATAR_COLORS = ['blue','green','red','purple','orange','indigo','emerald','sky','rose'];

function getAvatarColor(username) {
  const hash = Math.abs(username.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
  return AVATAR_COLORS[hash % 9];
}

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

  const fetchData = () => {
    if (!user) return;
    setLoading(true);
    getConversations().then(setConversations).finally(() => setLoading(false));
  };

  useEffect(fetchData, [user]);

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
      <div className="text-center py-16 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-yellow-50 dark:bg-yellow-950/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-3">请先登录后使用私信</p>
        <Button color="primary" variant="flat" size="sm" onPress={() => navigate('/login')}>
          去登录
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">私信</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{conversations.length} 个对话</p>
        </div>
        <Button
          color="primary"
          variant={showNew ? 'solid' : 'shadow'}
          size="sm"
          onPress={() => setShowNew(!showNew)}
          className="font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          新对话
        </Button>
      </div>

      {/* New Conversation Panel */}
      {showNew && (
        <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-5 mb-5 shadow-sm animate-slide-up">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 dark:focus:border-indigo-600 transition-all"
              placeholder="搜索用户..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {results.length > 0 && (
            <div className="mt-3 border border-gray-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
              {results.map((u) => (
                <div key={u.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden">
                      <img src={u.avatar || `/images/${getAvatarColor(u.username)}.jpg`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.username}</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 h-9 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      placeholder="发一条消息..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                    />
                    <Button size="sm" color="primary" onPress={() => handleStartChat(u)} isLoading={sending} className="font-medium">
                      发送
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {search && results.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">未找到用户</p>
          )}
        </div>
      )}

      {/* AI Chat Entry */}
      <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200/60 dark:border-indigo-800/40 cursor-pointer hover:shadow-sm transition-all" onClick={() => navigate('/chat/ai')}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
            R
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Rei AI 助手</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">点击开始与 AI 对话</p>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold">AI</span>
        </div>
      </div>

      {/* Conversations List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-400">加载中...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
            <ChatBubbleLeftEllipsisIcon className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-1">还没有对话</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">点击"新对话"开始聊天</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <div
              key={c.user_id}
              className="group bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-xl p-4 cursor-pointer hover-lift hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-all duration-200"
              onClick={() => navigate(`/chat/${c.user_id}`)}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                  <img src={c.avatar || `/images/${getAvatarColor(c.username)}.jpg`} alt="" className="w-full h-full object-cover" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {c.username}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                      {c.last_message_at?.slice(5, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{c.last_message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
