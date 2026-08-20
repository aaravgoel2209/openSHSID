import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { PlusIcon } from '@heroicons/react/24/outline';
import { getArticles } from '../api/knowledge';
import { getLabels } from '../api/labels';
import client from '../api/client';
import { useLang } from '../context/useLang';
import { localizeTitle } from '../utils/lang';

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const [allLabels, setAllLabels] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLabel, setSelectedLabel] = useState('');

  const fetchArticles = () => {
    setLoading(true);
    const params = {};
    if (selectedLabel) params.label = selectedLabel;
    client.get('/knowledge/articles/', { params }).then((r) => r.data)
      .then(setArticles)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getLabels().then(setAllLabels).catch(() => {});
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [selectedLabel]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">经验知识库</h1>
        <Button color="primary" variant="flat" onPress={() => navigate('/knowledge/create')}>
          <PlusIcon className="w-5 h-5" />
          分享经验
        </Button>
      </div>

      <div className="flex gap-2 mb-6 items-center flex-wrap">
        <button
          onClick={() => setSelectedLabel('')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !selectedLabel
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-400'
          }`}
        >全部</button>
        {allLabels.map((l) => (
          <button key={l.id} onClick={() => setSelectedLabel(String(l.id))}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              selectedLabel === String(l.id)
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-400'
            }`}
          >{l.name}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
            <PlusIcon className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-3">还没有经验分享</p>
          <Button color="primary" variant="flat" size="sm" onPress={() => navigate('/knowledge/create')}>
            来写第一篇吧
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <div
              key={a.id}
              className="group bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-xl p-5 cursor-pointer hover-lift hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-all duration-200"
              onClick={() => navigate(`/knowledge/${a.id}`)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{localizeTitle(a, lang)}</h2>
                  {a.labels?.map((l) => (
                    <span key={l.id} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium">{l.name}</span>
                  ))}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0 ml-2">{a.created_at?.slice(0, 10)} · {a.views} 次浏览</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {a.grade_name && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium">{a.grade_name}</span>
                )}
                {a.subject_name && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 font-medium">{a.subject_name}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
