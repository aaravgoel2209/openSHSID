import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { Chip } from '@heroui/react/chip';
import { Button } from '@heroui/react/button';
import { EyeIcon, HandThumbUpIcon, BookOpenIcon, PlusIcon } from '@heroicons/react/24/outline';
import { getArticles } from '../api/knowledge';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useUI } from '../context/UIContext';

const FLASK_URL = '';

/** SVG filter ID for liquid glass effect */
const SVG_FILTER_ID = 'liquid-glass-filter';

export default function HomeArticles() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isDark } = useContext(ThemeContext);
  const { complexity } = useUI();

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStyle, setFilterStyle] = useState('');

  // Update background filter based on dark/light mode
  useEffect(() => {
    if (isDark) {
      setFilterStyle('brightness(0.5) saturate(0.6) hue-rotate(180deg) contrast(1.4)');
    } else {
      setFilterStyle('brightness(0.85) saturate(0.6) sepia(0.15)');
    }
  }, [isDark]);

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

  // Common backdrop blur classes
  const glassBackdrop = complexity !== 'simple'
    ? 'backdrop-blur-2xl bg-white/60 dark:bg-black/60'
    : 'bg-white dark:bg-slate-900';

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* SVG filter definition */}
      <svg className="absolute hidden" aria-hidden="true">
        <defs>
          <filter id={SVG_FILTER_ID}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02"
              numOctaves="3"
              result="noise"
            />
            <feDisplacementMap in="blur" in2="noise" scale="25" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="displaced" />
            </feMerge>
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Background layer with image and dynamic filter */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'var(--page-bg-image, none)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          filter: filterStyle,
          transition: 'filter 0.6s ease',
        }}
      />

      {/* Liquid glass overlay */}
      <div
        className="absolute inset-0 z-1"
        style={{
          backdropFilter: 'blur(16px) saturate(200%)',
          WebkitBackdropFilter: 'blur(16px) saturate(200%)',
          backgroundColor: isDark
            ? 'rgba(0, 0, 0, 0.35)'
            : 'rgba(255, 255, 255, 0.15)',
          filter: `url(#${SVG_FILTER_ID})`,
          transition: 'background-color 0.5s, filter 0.5s',
        }}
      />

      {/* Main content */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className={`flex justify-between items-center mb-6 p-4 rounded-2xl ${glassBackdrop} border border-white/20 dark:border-white/10 shadow-xl transition-colors`}>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">知识库</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{articles.length} 篇文章</p>
          </div>
          <Button color="primary" variant="shadow" onPress={() => navigate('/knowledge/create')} className="font-medium">
            <PlusIcon className="w-4 h-4" />
            发布文章
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-gray-400">加载中...</p>
          </div>
        ) : articles.length === 0 ? (
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
                className={`group ${glassBackdrop} border border-white/20 dark:border-white/10 rounded-xl p-5 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-all duration-200 shadow-lg`}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => handleClick(a)}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2 truncate">
                      {a.title}
                    </h2>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip size="sm" color="primary" variant="flat" className="text-xs">{a.grade_name}</Chip>
                      <Chip size="sm" color="success" variant="flat" className="text-xs">{a.subject_name}</Chip>
                      {a.labels?.map(l => (
                        <Chip key={l.id} size="sm" variant="flat" className="text-xs">{l.name}</Chip>
                      ))}
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

                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 mt-1">{a.created_at?.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
