import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { Chip } from '@heroui/react/chip';
import { getArticles } from '../api/knowledge';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';

const FLASK_URL = 'http://localhost:5000';

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">知识库</h1>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : articles.length === 0 ? (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-blue-700 dark:text-blue-300">还没有文章。</div>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-gray-900 rounded-lg p-4 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 transition-all"
              onClick={() => handleClick(a)}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold">{a.title}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-2">{a.created_at?.slice(0, 10)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Chip size="sm" color="primary">{a.grade_name}</Chip>
                <Chip size="sm" color="success">{a.subject_name}</Chip>
                <span className="text-xs text-gray-500 dark:text-gray-400">{a.views} 次浏览 · {a.like_count} 赞{a.push_score !== undefined ? ` · 推荐分 ${a.push_score}` : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
