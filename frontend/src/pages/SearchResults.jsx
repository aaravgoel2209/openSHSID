import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { Chip } from '@heroui/react/chip';
import { getQuestions } from '../api/qa';
import { getArticles } from '../api/knowledge';

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') || '';
  const [questions, setQuestions] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q.trim()) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getQuestions(q),
      getArticles(null, null, q),
    ]).then(([qs, as]) => {
      setQuestions(qs);
      setArticles(as);
    }).finally(() => setLoading(false));
  }, [q]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">搜索: {q}</h1>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : (
        <>
          {questions.length === 0 && articles.length === 0 ? (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-blue-700 dark:text-blue-300">没有找到结果。</div>
          ) : (
            <>
              {questions.length > 0 && (
                <>
                  <h2 className="text-lg font-semibold mb-3">问答 ({questions.length})</h2>
                  <div className="space-y-2 mb-6">
                    {questions.map((q) => (
                      <div key={q.id} className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-gray-900 rounded-lg p-3 cursor-pointer hover:border-primary-300 transition-all" onClick={() => navigate(`/qa/questions/${q.id}`)}>
                        <div className="font-medium">{q.title}</div>
                        <div className="text-xs text-gray-500 mt-1">{q.answer_count} 个回答 · {q.views} 次浏览</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {articles.length > 0 && (
                <>
                  <h2 className="text-lg font-semibold mb-3">知识库 ({articles.length})</h2>
                  <div className="space-y-2">
                    {articles.map((a) => (
                      <div key={a.id} className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-gray-900 rounded-lg p-3 cursor-pointer hover:border-primary-300 transition-all" onClick={() => navigate(`/knowledge/${a.id}`)}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{a.title}</span>
                          <Chip size="sm" color="primary">{a.grade_name}</Chip>
                          <Chip size="sm" color="success">{a.subject_name}</Chip>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
