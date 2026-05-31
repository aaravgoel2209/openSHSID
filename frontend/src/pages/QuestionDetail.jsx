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
          <div key={a.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
            <p className="text-gray-700 whitespace-pre-wrap">{a.content}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
              <span>{a.created_at?.slice(0, 16).replace('T', ' ')}{a.author_name ? ` · ${a.author_name}` : ''}</span>
              <button
                onClick={async () => {
                  const res = await toggleAnswerLike(a.id);
                  const updated = question.answers.map(x => x.id === a.id ? {...x, is_liked: res.liked, like_count: res.count} : x);
                  setQuestion({...question, answers: updated});
                }}
                className={`flex items-center gap-1 transition-colors ${a.is_liked ? 'text-red-500' : 'hover:text-red-400'}`}
              >
                <svg className="w-3.5 h-3.5" fill={a.is_liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                </svg>
                {a.like_count || 0}
              </button>
            </div>
          </div>
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
