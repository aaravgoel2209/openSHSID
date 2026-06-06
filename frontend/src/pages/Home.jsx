import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { PlusIcon } from '@heroicons/react/24/outline';
import { getQuestions } from '../api/qa';

export default function Home() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuestions()
      .then(setQuestions)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">所有问题</h1>
        <Button color="primary" variant="flat" onPress={() => navigate('/qa/ask')}>
          <PlusIcon className="w-5 h-5" />
          提问
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-blue-700 dark:text-blue-300">
          还没有问题，<button className="text-blue-700 dark:text-blue-300 underline font-medium" onClick={() => navigate('/qa/ask')}>来提第一个问题吧</button>。
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <div
              key={q.id}
              className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-gray-900 rounded-lg p-4 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all"
              onClick={() => navigate(`/qa/questions/${q.id}`)}
            >
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <h2 className="text-lg font-semibold">{q.title}</h2>
                {q.labels?.map((l) => (
                  <span key={l.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-950 text-gray-500 dark:text-gray-400">{l.name}</span>
                ))}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {q.created_at?.slice(0, 16).replace('T', ' ')}
                {q.author_name ? ` · ${q.author_name}` : ''}
                {' · '}
                {q.answer_count} 个回答
                {' · '}
                {q.views} 次浏览
                {' · '}
                {q.like_count} 赞
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
