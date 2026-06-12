import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { Chip } from '@heroui/react/chip';
import { Button } from '@heroui/react/button';
import { EyeIcon, HandThumbUpIcon, BookOpenIcon, PlusIcon } from '@heroicons/react/24/outline';
import { getArticles } from '../api/knowledge';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';

const FLASK_URL = '';

export default function HomeArticles() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getArticles()
      .then(setArticles)
      .finally(() => setLoading(false));
  }, []);

  const handleClick = async (article) => {
    if (!user) { navigate(`/knowledge/${article.id}`); return; }

    try {
      const prof = await client.get('/auth/profile/');
      const userEmb = prof.data.embedding?.vector || Array(32).fill(0);
      fetch(`${FLASK_URL}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_emb: userEmb,
          items: [{
            emb: article.embedding || Array(32).fill(0),
            heat: 2.0 + (article.views || 0) * 0.1 + (article.like_count || 0) * 0.3,
            clicked: true,
          }],
        }),
      }).catch(() => {});
    } catch {}

    navigate(`/knowledge/${article.id}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">知识库</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{articles.length} 篇文章</p>
        </div>
        <Button color="primary" variant="shadow" onPress={() => navigate('/knowledge/create')} className="font-medium">
          <PlusIcon className="w-4 h-4" />
          发布文章
        </Button>
      </div>

      {articles.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
            <BookOpenIcon className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-3">还没有文章</p>
          <Button color="primary" variant="flat" size="sm" onPress={() => navigate('/knowledge/create')}>
            发布第一篇文章
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a, index) => (
            <div
              key={a.id}
              className="group bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-xl p-5 cursor-pointer hover-lift hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-all duration-200"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleClick(a)}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2 truncate">
                    {a.title}
                  </h2>

                  {/* Tags & Meta */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip size="sm" color="primary" variant="flat" className="text-xs">{a.grade_name}</Chip>
                    <Chip size="sm" color="success" variant="flat" className="text-xs">{a.subject_name}</Chip>
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <EyeIcon className="w-3.5 h-3.5" />
                      {a.views}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <HandThumbUpIcon className="w-3.5 h-3.5" />
                      {a.like_count}
                    </span>
                    {a.push_score !== undefined && (
                      <span className="text-xs text-amber-500 dark:text-amber-400 font-medium">
                        ★ {a.push_score}
                      </span>
                    )}
                  </div>
                </div>

                {/* Date */}
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 mt-1">{a.created_at?.slice(0, 10)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
