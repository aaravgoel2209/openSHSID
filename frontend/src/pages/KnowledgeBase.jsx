import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { Chip } from '@heroui/react/chip';
import { PlusIcon } from '@heroicons/react/24/outline';
import { getArticles } from '../api/knowledge';
import { getLabels } from '../api/labels';
import client from '../api/client';

export default function KnowledgeBase() {
  const navigate = useNavigate();
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
              ? 'bg-primary text-white border-primary'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary'
          }`}
        >全部</button>
        {allLabels.map((l) => (
          <button key={l.id} onClick={() => setSelectedLabel(String(l.id))}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              selectedLabel === String(l.id)
                ? 'bg-primary text-white border-primary'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary'
            }`}
          >{l.name}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : articles.length === 0 ? (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-blue-700 dark:text-blue-300">
          还没有经验分享，<button className="text-blue-700 underline font-medium" onClick={() => navigate('/knowledge/create')}>来写第一篇吧</button>。
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-900 rounded-lg p-4 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all"
              onClick={() => navigate(`/knowledge/${a.id}`)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-lg font-semibold">{a.title}</h2>
                  {a.labels?.map((l) => (
                    <span key={l.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{l.name}</span>
                  ))}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0 ml-2">{a.created_at?.slice(0, 10)} · {a.views} 次浏览</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Chip size="sm" color="primary">{a.grade_name}</Chip>
                <Chip size="sm" color="success">{a.subject_name}</Chip>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
