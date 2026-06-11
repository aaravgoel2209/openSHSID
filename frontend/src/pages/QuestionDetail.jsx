import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { TextArea } from '@heroui/react/textarea';
import { ArrowLeftIcon, EyeIcon, HandThumbUpIcon } from '@heroicons/react/24/outline';
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
  const [waitingRei, setWaitingRei] = useState(false);
  const viewed = useRef(null);

  const fetchData = () => {
    setLoading(true);
    getQuestion(id)
      .then(setQuestion)
      .finally(() => setLoading(false));
    if (viewed.current !== id) {
      viewed.current = id;
      client.post(`/qa/questions/${id}/view/`).catch(() => {});
    }
  };

  useEffect(fetchData, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    const mentionedRei = /@Rei\b/i.test(content);
    setSubmitting(true);
    try {
      await createAnswer(id, content);
      setContent('');
      fetchData();
      if (mentionedRei) {
        setWaitingRei(true);
        let attempts = 0;
        const findRei = (answers) => answers?.some(a =>
          a.author_name === 'Rei' || findRei(a.replies)
        );
        const poll = setInterval(async () => {
          attempts++;
          const data = await getQuestion(id);
          if (findRei(data.answers) || attempts >= 30) {
            clearInterval(poll);
            setWaitingRei(false);
            setQuestion(data);
          }
        }, 2000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-400">加载中...</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-3">问题不存在</p>
        <Button variant="flat" size="sm" onPress={() => navigate('/qa')}>返回列表</Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => navigate('/qa')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        返回列表
      </button>

      {/* Question Card */}
      <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 mb-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">{question.title}</h1>

        {/* Labels */}
        {question.labels?.length > 0 && (
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {question.labels.map((l) => (
              <span key={l.id} className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium">
                {l.name}
              </span>
            ))}
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-5">
          <span className="font-medium text-gray-700 dark:text-gray-300">{question.author_name || '匿名'}</span>
          <span>{question.created_at?.slice(0, 16).replace('T', ' ')}</span>
          <span className="flex items-center gap-1">
            <EyeIcon className="w-4 h-4" />
            {question.views}
          </span>
          <button
            onClick={async () => {
              const res = await toggleQuestionLike(question.id);
              setQuestion({...question, is_liked: res.liked, like_count: res.count});
            }}
            className={`flex items-center gap-1 transition-all duration-200 ${
              question.is_liked
                ? 'text-rose-500'
                : 'hover:text-rose-400'
            }`}
          >
            <HandThumbUpIcon className={`w-4 h-4 ${question.is_liked ? 'fill-current' : ''}`} />
            {question.like_count}
          </button>
        </div>

        {/* Content */}
        <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: question.content }} />

        {/* Debug info (embedding/heat) */}
        {question.embedding && (
          <details className="mt-4 text-xs text-gray-400 cursor-pointer">
            <summary className="inline hover:text-gray-600 transition-colors">向量 (32维)</summary>
            <p className="mt-2 font-mono bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3 overflow-x-auto">
              [{question.embedding.map(v => v.toFixed(4)).join(', ')}]
            </p>
          </details>
        )}
        {question.heat !== null && question.heat !== undefined && (
          <p className="mt-2 text-xs text-gray-400">热度: {question.heat}</p>
        )}
      </div>

      {/* Answers Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          回答
          <span className="text-sm font-normal bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
            {question.answers?.length || 0}
          </span>
        </h2>

        {question.answers?.length === 0 && (
          <div className="bg-gray-50 dark:bg-slate-800/30 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">暂无回答，来写第一个回答吧</p>
          </div>
        )}

        <div className="space-y-3">
          {question.answers?.map((a) => (
            <AnswerCard key={a.id} answer={a} question={question} user={user}
              onToggleLike={async (answerId) => {
                const res = await toggleAnswerLike(answerId);
                const updateItem = (items) => items.map(x => ({
                  ...x,
                  is_liked: x.id === answerId ? res.liked : x.is_liked,
                  like_count: x.id === answerId ? res.count : x.like_count,
                  replies: x.replies ? updateItem(x.replies) : x.replies,
                }));
                setQuestion({...question, answers: updateItem(question.answers)});
              }}
              onReply={() => { fetchData(); }}
            />
          ))}
        </div>
      </div>

      {/* Submit Answer */}
      <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">写回答</h3>
        <form onSubmit={handleSubmit}>
          <TextArea
            placeholder={user ? '写下你的回答... 输入 @Rei 可以召唤AI助手回答' : '登录后可回答'}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            isRequired
            isDisabled={!user}
            className="mb-4"
            minRows={3}
            labelPlacement="outside"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" color="primary" isLoading={submitting} isDisabled={submitting || !user} className="font-medium">
              {submitting ? '提交中...' : '提交回答'}
            </Button>
            {waitingRei && (
              <span className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
                <Spinner size="sm" />
                Rei 正在思考中...
              </span>
            )}
            {!user && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">登录</Link>
                后可以回答
              </p>
            )}
          </div>
        </form>
      </div>
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
    <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-xl p-5 transition-all duration-200 hover:border-gray-300 dark:hover:border-slate-700">
      {/* Content */}
      <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: answer.content }} />

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
        <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
          {answer.author_name || '匿名'}
          {answer.author_name === 'Rei' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold">AI</span>
          )}
        </span>
        <span>{answer.created_at?.slice(0, 16).replace('T', ' ')}</span>
        <button
          onClick={() => onToggleLike(answer.id)}
          className={`flex items-center gap-1 transition-all duration-200 ${
            answer.is_liked ? 'text-rose-500' : 'hover:text-rose-400'
          }`}
        >
          <HandThumbUpIcon className={`w-3.5 h-3.5 ${answer.is_liked ? 'fill-current' : ''}`} />
          {answer.like_count || 0}
        </button>
        <button
          onClick={() => setShowReply(!showReply)}
          className="hover:text-indigo-500 transition-colors font-medium"
        >
          回复
        </button>
      </div>

      {/* Reply Form */}
      {showReply && (
        <form onSubmit={handleReply} className="mt-3 flex gap-2 animate-slide-up">
          <input
            className="flex-1 h-9 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 dark:focus:border-indigo-600 transition-all"
            placeholder="写下回复..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            disabled={!user}
          />
          <Button type="submit" size="sm" color="primary" isLoading={sending} isDisabled={!user || !replyContent.trim()}>
            回复
          </Button>
        </form>
      )}

      {/* Nested Replies */}
      {answer.replies?.length > 0 && (
        <div className="mt-4 ml-4 pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/50 space-y-3">
          {answer.replies.map((r) => (
            <AnswerCard key={r.id} answer={r} question={question} user={user}
              onToggleLike={onToggleLike} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
}
