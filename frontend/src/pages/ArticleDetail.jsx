import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { Avatar, AvatarImage, AvatarFallback } from '@heroui/react/avatar';
import { getArticle, toggleArticleLike } from '../api/knowledge';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { renderMarkdown } from '../utils/markdown';

const AVATAR_COLORS = ['blue','green','red','purple','orange','indigo','emerald','sky','rose'];
const avatarUrl = (name) => {
  if (!name) return '';
  const idx = Math.abs(name.split('').reduce((a,c)=>a*31+c.charCodeAt(0),0)) % AVATAR_COLORS.length;
  return `/images/${AVATAR_COLORS[idx]}.jpg`;
};

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
        if (user && data.embedding) {
          client.get('/auth/profile/').then((prof) => {
            const userEmb = prof.data.embedding?.vector || Array(32).fill(0);
            fetch('', {
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
      {/* Gradient accent line */}
      <div className="h-1 w-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mb-6" />

      {/* Labels */}
      {article.labels?.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {article.labels.map((l) => (
            <span key={l.id} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">{l.name}</span>
          ))}
        </div>
      )}

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">{article.title}</h1>

      {/* Meta bar */}
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Avatar size="sm" className="w-6 h-6">
            <AvatarImage src={avatarUrl(article.author_name_display)} />
            <AvatarFallback className="text-xs">{article.author_name_display?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-gray-700 dark:text-gray-300">{article.author_name_display || '匿名'}</span>
        </div>
        <span>·</span>
        <span>{article.created_at?.slice(0, 10)}</span>
        <span>·</span>
        <span>{article.views} 次浏览</span>
        <button
          onClick={async () => {
            const res = await toggleArticleLike(article.id);
            setArticle({...article, is_liked: res.liked, like_count: res.count});
          }}
          className={`flex items-center gap-1 transition-all duration-200 ${
            article.is_liked ? 'text-rose-500' : 'hover:text-rose-400'
          }`}
        >
          <svg className={`w-4 h-4 ${article.is_liked ? 'fill-current' : ''}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none">
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
          </svg>
          {article.like_count}
        </button>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 hover:shadow-sm hover:border-gray-300 dark:hover:border-slate-700 transition-all duration-200 text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }} />

      {/* Debug info */}
      {article.embedding && (
        <details className="mt-4 text-xs text-gray-400 cursor-pointer">
          <summary className="inline hover:text-gray-600 transition-colors">向量 (32维)</summary>
          <p className="mt-2 font-mono bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3 overflow-x-auto">
            [{article.embedding.map(v => v.toFixed(4)).join(', ')}]
          </p>
        </details>
      )}
      {article.heat !== null && article.heat !== undefined && (
        <p className="mt-2 text-xs text-gray-400">热度: {article.heat}</p>
      )}

      {/* Actions */}
      <hr className="border-gray-200 dark:border-gray-800 my-6" />
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
          >删除</Button>
        )}
      </div>
    </div>
  );
}
