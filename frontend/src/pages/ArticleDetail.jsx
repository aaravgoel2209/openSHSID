import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { Chip } from '@heroui/react/chip';
import { getArticle, toggleArticleLike } from '../api/knowledge';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';

const FLASK_URL = 'http://localhost:5000';

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const viewed = useRef(null);

  useEffect(() => {
    const viewedId = viewed.current;
    setLoading(true);
    getArticle(id).then((data) => {
      setArticle(data);
      if (viewedId !== id) {
        viewed.current = id;
        client.post(`/knowledge/articles/${id}/view/`).catch(() => {});
        // 通知 Flask 训练
        if (user && data.embedding) {
          client.get('/auth/profile/').then((prof) => {
            const userEmb = prof.data.embedding?.vector || Array(32).fill(0);
            fetch(`${FLASK_URL}/click`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_emb: userEmb,
                items: [{ emb: data.embedding, heat: 2.0 + (data.views || 0) * 0.1 + (data.like_count || 0) * 0.3, clicked: true }],
              }),
            }).catch(() => {});
          }).catch(() => {});
        }
      }
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!article) {
    return <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">文章不存在。</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <Chip size="sm" color="primary" className="mr-2">{article.grade_name}</Chip>
        <Chip size="sm" color="success" className="mr-2">{article.subject_name}</Chip>
        {article.author_name_display && (
          <span className="text-sm text-gray-500 ml-1">by {article.author_name_display}</span>
        )}
      </div>
      <h1 className="text-2xl font-bold mb-2">{article.title}</h1>
      {article.labels?.length > 0 && (
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {article.labels.map((l) => (
            <span key={l.id} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-950 text-gray-500 dark:text-gray-400">{l.name}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
        <span>{article.created_at?.slice(0, 16).replace('T', ' ')} · {article.views} 次浏览</span>
        <button
          onClick={async () => {
            const res = await toggleArticleLike(article.id);
            setArticle({...article, is_liked: res.liked, like_count: res.count});
          }}
          className={`flex items-center gap-1 transition-colors ${article.is_liked ? 'text-red-500' : 'hover:text-red-400'}`}
        >
            <svg className="w-4 h-4" fill={article.is_liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
            </svg>
          {article.like_count}
        </button>
      </div>
      {article.embedding && (
        <details className="mt-2 mb-4 text-xs text-gray-400 dark:text-gray-400 cursor-pointer">
          <summary className="inline">向量 (32维)</summary>
          <p className="mt-1 font-mono">[{article.embedding.map(v => v.toFixed(4)).join(', ')}]</p>
        </details>
      )}
      {article.heat !== null && article.heat !== undefined && (
        <p className="mt-1 mb-4 text-xs text-gray-400">热度: {article.heat}</p>
      )}
      <hr className="border-gray-200 mb-6" />
      <p className="text-gray-700 whitespace-pre-wrap">{article.content}</p>
      <hr className="border-gray-200 my-6" />
      <div className="flex items-center gap-2">
        <Button variant="light" onPress={() => navigate(-1)}>返回</Button>
        {user?.is_staff && (
          <Button
            className="bg-red-500 text-white hover:bg-red-600"
            onPress={async () => {
              if (!window.confirm('确认删除这篇文章？')) return;
                try {
                  await client.delete(`/knowledge/articles/${id}/`);
                  navigate('/');
                } catch {}
            }}
          >
            删除
          </Button>
        )}
      </div>
    </div>
  );
}
