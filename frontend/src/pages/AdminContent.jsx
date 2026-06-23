import { motion } from 'framer-motion';
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { Button } from '@heroui/react/button';
import { AuthContext } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Card from '../components/Card';

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'questions', label: '问题' },
  { key: 'answers', label: '回答' },
  { key: 'articles', label: '文章' },
];

export default function AdminContent() {
  const { user, token } = useContext(AuthContext);
  const { hasGlass } = useUI();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!user?.is_staff) { navigate('/'); return; }
    const fetchContent = async () => {
      setLoading(true);
      try {
        const base = '/api/auth/admin/content/';
        const url = activeTab === 'all' ? base : `${base}?type=${activeTab}`;
        const response = await fetch(url, {
          headers: { 'Authorization': `Token ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch content');
        setContent(await response.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [user, token, navigate, activeTab]);

  if (!user?.is_staff) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl mx-auto px-4 py-6"
    >
      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-gray-200 dark:border-slate-800">
        <Button variant="light" size="sm" onPress={() => navigate('/admin')}>← 返回</Button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">内容管理</h1>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm mb-6">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-6 p-1 rounded-xl bg-gray-100 dark:bg-slate-800 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : content ? (
        <div className="space-y-8">
          {content.questions?.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                问题 ({content.questions.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {content.questions.map((q, idx) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                  >
                    <Card glass={hasGlass} padded>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2 line-clamp-2">{q.title}</h3>
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                        <p>作者: {q.author}</p>
                        <p>浏览: {q.views}</p>
                        <p>{new Date(q.created_at).toLocaleDateString('zh-CN')}</p>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {content.answers?.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                回答 ({content.answers.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {content.answers.map((a, idx) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                  >
                    <Card glass={hasGlass} padded>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2 line-clamp-2">问题: {a.question}</h3>
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                        <p>作者: {a.author}</p>
                        <p>{new Date(a.created_at).toLocaleDateString('zh-CN')}</p>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {content.articles?.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                文章 ({content.articles.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {content.articles.map((a, idx) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                  >
                    <Card glass={hasGlass} padded>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2 line-clamp-2">{a.title}</h3>
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                        <p>作者: {a.author}</p>
                        <p>{new Date(a.created_at).toLocaleDateString('zh-CN')}</p>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {!content.questions?.length && !content.answers?.length && !content.articles?.length && (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">暂无内容</div>
          )}
        </div>
      ) : null}
    </motion.div>
  );
}
