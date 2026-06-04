import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { TextArea } from '@heroui/react/textarea';
import { getQuestion, createAnswer, toggleQuestionLike, toggleAnswerLike } from '../api/qa';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';

export default function QuestionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const viewed = useRef(null);

  const fetch = () => {
    setLoading(true);
    getQuestion(id)
      .then(setQuestion)
      .finally(() => setLoading(false));
    if (viewed.current !== id) {
      viewed.current = id;
      client.post(`/qa/questions/${id}/view/`).catch(() => {});
    }
  };

  useEffect(fetch, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await createAnswer(id, content);
      setContent('');
      fetch();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!question) {
    return <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">问题不存在。</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">{question.title}</h1>
        {question.labels?.length > 0 && (
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {question.labels.map((l) => (
              <span key={l.id} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{l.name}</span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span>{question.created_at?.slice(0, 16).replace('T', ' ')}{question.author_name ? ` · ${question.author_name}` : ''} · {question.views} 次浏览</span>
          <button
            onClick={async () => {
              const res = await toggleQuestionLike(question.id);
              setQuestion({...question, is_liked: res.liked, like_count: res.count});
            }}
            className={`flex items-center gap-1 transition-colors ${question.is_liked ? 'text-red-500' : 'hover:text-red-400'}`}
          >
            <svg className="w-4 h-4" fill={question.is_liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
            </svg>
            {question.like_count}
          </button>
        </div>
        {question.embedding && (
          <details className="mt-2 text-xs text-gray-400 dark:text-gray-500 cursor-pointer">
            <summary className="inline">向量 (32维)</summary>
            <p className="mt-1 font-mono">[{question.embedding.map(v => v.toFixed(4)).join(', ')}]</p>
          </details>
        )}
        {question.heat !== null && question.heat !== undefined && (
          <p className="mt-1 text-xs text-gray-400">热度: {question.heat}</p>
        )}
        <p className="mt-4 text-gray-700 whitespace-pre-wrap">{question.content}</p>
      </div>

      <hr className="border-gray-200 mb-6" />

      <h2 className="text-xl font-semibold mb-4">
        回答 ({question.answers?.length || 0})
      </h2>

      {question.answers?.length === 0 && (
        <p className="text-gray-500 mb-4">暂无回答。</p>
      )}

      <div className="space-y-3 mb-6">
        {question.answers?.map((a) => (
          <AnswerCard key={a.id} answer={a} question={question} user={user}
            onToggleLike={async (id) => {
              const res = await toggleAnswerLike(id);
              const updateItem = (items) => items.map(x => ({
                ...x,
                is_liked: x.id === id ? res.liked : x.is_liked,
                like_count: x.id === id ? res.count : x.like_count,
                replies: x.replies ? updateItem(x.replies) : x.replies,
              }));
              setQuestion({...question, answers: updateItem(question.answers)});
            }}
            onReply={() => { fetch(); }}
          />
        ))}
      </div>

      <hr className="border-gray-200 mb-6" />

      <h3 className="text-lg font-semibold mb-3">提交回答</h3>
      <form onSubmit={handleSubmit}>
        <TextArea
          placeholder={user ? '写下你的回答...' : '登录后可回答'}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          isRequired
          isDisabled={!user}
          className="mb-4"
          minRows={3}
          labelPlacement="outside"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" color="primary" isLoading={submitting} isDisabled={submitting || !user}>
            {submitting ? '提交中...' : '提交'}
          </Button>
          <Button variant="light" onPress={() => navigate('/qa')}>返回列表</Button>
          {!user && (
            <p className="text-sm text-gray-500 dark:text-gray-400 ml-2">
              <Link to="/login" className="text-primary-600 underline">登录</Link>后可以回答
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

function AnswerCard({ answer, question, user, onToggleLike, onReply }) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSending(true);
    try {
      await client.post(`/qa/questions/${question.id}/answers/`, {
        content: replyContent,
        parent: answer.id,
      });
      setReplyContent('');
      setShowReply(false);
      onReply(answer.id, replyContent);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
      <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{answer.content}</p>
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
        <span>{answer.created_at?.slice(0, 16).replace('T', ' ')}{answer.author_name ? ` · ${answer.author_name}` : ''}</span>
        <button onClick={() => onToggleLike(answer.id)}
          className={`flex items-center gap-1 transition-colors ${answer.is_liked ? 'text-red-500' : 'hover:text-red-400'}`}>
          <svg className="w-3.5 h-3.5" fill={answer.is_liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
          </svg>
          {answer.like_count || 0}
        </button>
        <button onClick={() => setShowReply(!showReply)} className="hover:text-primary transition-colors">回复</button>
      </div>

      {showReply && (
        <form onSubmit={handleReply} className="mt-3 flex gap-2">
          <input className="flex-1 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="写下回复..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)} disabled={!user} />
          <Button type="submit" size="sm" color="primary" isLoading={sending} isDisabled={!user || !replyContent.trim()}>回复</Button>
        </form>
      )}

      {answer.replies?.length > 0 && (
        <div className="mt-3 ml-4 pl-3 border-l-2 border-gray-200 dark:border-gray-600 space-y-2">
          {answer.replies.map((r) => (
            <AnswerCard key={r.id} answer={r} question={question} user={user}
              onToggleLike={onToggleLike} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
}
