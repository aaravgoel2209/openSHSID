import { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { PaperAirplaneIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import MarkdownView from '../components/MarkdownView';
import { FLASK_BASE } from '../config';

// 读取图片并按最长边缩放，导出 JPEG base64 data URL（控制体积与 token）
function fileToDataURL(file, maxDim = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const s = maxDim / Math.max(width, height);
          width = Math.round(width * s);
          height = Math.round(height * s);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AiChat() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);  // 待发送图片（base64 data URL）
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  // 每个用户固定一个会话，AI 聊天记录得以持久化与恢复
  const sessionRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 用户就绪后：绑定固定会话并恢复历史记录
  useEffect(() => {
    if (!user) return;
    sessionRef.current = `chat-user-${user.id}`;
    fetch(`${FLASK_BASE}/rei/history?session_id=${encodeURIComponent(sessionRef.current)}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => {
        const msgs = (d.messages || [])
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content }));
        if (msgs.length) setMessages(msgs);
      })
      .catch(() => {});
  }, [user]);

  // 更新最后一条（助手）消息
  const patchLast = (patch) =>
    setMessages((m) => {
      const c = [...m];
      c[c.length - 1] = { ...c[c.length - 1], ...patch };
      return c;
    });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setImage(await fileToDataURL(file)); } catch { /* 忽略读取失败 */ }
  };

  const handleSend = async () => {
    if ((!input.trim() && !image) || loading) return;
    const userMsg = input.trim();
    const img = image;
    setInput('');
    setImage(null);
    // 追加用户消息（含图片）+ 一个空的流式助手气泡
    setMessages((m) => [...m,
      { role: 'user', content: userMsg, image: img },
      { role: 'assistant', content: '', streaming: true },
    ]);
    setLoading(true);
    try {
      const res = await fetch(`${FLASK_BASE}/rei/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_title: '', question_content: '', trigger_content: userMsg, session_id: sessionRef.current, image: img }),
      });
      if (!res.ok || !res.body) throw new Error('stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';
      let reasoningAcc = '';
      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE 事件以空行分隔
        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') { done = true; continue; }
            let ev;
            try { ev = JSON.parse(payload); } catch { continue; }
            if (ev.type === 'content') {
              acc += ev.text;
              patchLast({ content: acc });
            } else if (ev.type === 'reasoning') {
              reasoningAcc += ev.text;
              patchLast({ reasoning: reasoningAcc });
            } else if (ev.type === 'error') {
              acc += `\n\n[出错：${ev.text}]`;
              patchLast({ content: acc });
            }
          }
        }
      }
      patchLast({ content: acc || '（模型未返回有效回答）', streaming: false });
    } catch {
      patchLast({ content: '请求失败，请检查模型服务是否运行。', streaming: false });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-yellow-700 dark:text-yellow-300">
        请先登录后使用 AI 对话。
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-800">
        <Button variant="light" size="sm" onPress={() => navigate('/chat')}>← 返回</Button>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">R</div>
        <h1 className="text-lg font-bold">Rei AI 助手</h1>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold">AI</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p>发送消息开始与 Rei 对话</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              m.role === 'user'
                ? 'bg-indigo-500 text-white rounded-br-sm'
                : 'bg-gray-100 dark:bg-slate-800/50 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-200/60 dark:border-slate-700/60'
            }`}>
              {m.image && (
                <img src={m.image} alt="附图" className="rounded-lg max-h-60 mb-2 block" />
              )}
              {m.role === 'assistant' && m.reasoning && (
                <details open={m.streaming} className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  <summary className="cursor-pointer select-none">💭 思考过程</summary>
                  <div className="mt-1 whitespace-pre-wrap border-l-2 border-gray-300 dark:border-slate-600 pl-2 opacity-80">{m.reasoning}</div>
                </details>
              )}
              {m.streaming && !m.content && !m.reasoning ? (
                <Spinner size="sm" />
              ) : (
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  <MarkdownView as="span" markdown={m.content} />
                  {m.streaming && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 -mb-0.5 align-middle bg-indigo-500 animate-pulse" aria-hidden="true" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div>
        {image && (
          <div className="mb-2 relative inline-block">
            <img src={image} alt="预览" className="h-20 rounded-lg border border-gray-200 dark:border-slate-700" />
            <button
              onClick={() => setImage(null)}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center hover:bg-gray-800"
              title="移除图片"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <Button onPress={() => fileRef.current?.click()} variant="flat" isIconOnly isDisabled={loading} title="添加图片">
            <PhotoIcon className="w-5 h-5" />
          </Button>
          <textarea
            className="flex-1 min-h-[44px] max-h-32 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
            placeholder="输入消息..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={loading}
          />
          <Button onPress={handleSend} color="primary" isIconOnly isLoading={loading} isDisabled={(!input.trim() && !image) || loading}>
            <PaperAirplaneIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
