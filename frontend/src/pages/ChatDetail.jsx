import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { Avatar, AvatarImage, AvatarFallback } from '@heroui/react/avatar';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { getMessages, sendMessage } from '../api/chat';
import { AuthContext } from '../context/AuthContext';

export default function ChatDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

const colors = ['blue','green','red','purple','orange','indigo','emerald','sky','rose'];
const avatarUrl = (name) => {
  const idx = Math.abs(name.split('').reduce((a,c)=>a*31+c.charCodeAt(0),0)) % colors.length;
  return `https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/${colors[idx]}.jpg`;
};

  const fetch = () => {
    setLoading(true);
    getMessages(userId).then(setMessages).finally(() => setLoading(false));
  };

  useEffect(fetch, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      await sendMessage(parseInt(userId), content);
      setContent('');
      fetch();
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-yellow-700 dark:text-yellow-300">
        请先登录。
      </div>
    );
  }

  const otherName = messages.length > 0
    ? (messages[0].sender === user.id ? messages[0].recipient_name : messages[0].sender_name)
    : `用户 ${userId}`;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <Button variant="light" size="sm" onPress={() => navigate('/chat')}>← 返回</Button>
        <h1 className="text-xl font-bold">{otherName}</h1>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {loading ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-500 py-10">暂无消息，发送第一条消息吧。</p>
        ) : (
          messages.map((m) => {
            const isMe = m.sender === user.id;
            const name = isMe ? user.username : m.sender_name;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => navigate(`/user/${m.sender}`)} className="shrink-0">
                  <Avatar size="sm" className="cursor-pointer hover:opacity-80 transition-opacity">
                    <AvatarImage src={avatarUrl(name)} />
                    <AvatarFallback>{name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </button>
                <div className={`max-w-[70%] rounded-xl px-4 py-2 ${
                  isMe
                    ? 'bg-blue-500 text-white rounded-br-sm'
                    : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-bl-sm'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  <p className={`text-xs mt-1 ${isMe ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                    {m.created_at?.slice(11, 16)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 items-end">
        <input
          className="flex-1 h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="输入消息..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button type="submit" color="primary" isIconOnly isLoading={sending} isDisabled={!content.trim()}>
          <PaperAirplaneIcon className="w-5 h-5" />
        </Button>
      </form>
    </div>
  );
}
