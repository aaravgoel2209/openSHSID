import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { Chip } from '@heroui/react/chip';
import { PlusIcon } from '@heroicons/react/24/outline';
import { getGrades, getSubjects, getArticles } from '../api/knowledge';

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const fetchArticles = () => {
    setLoading(true);
    getArticles(selectedGrade || undefined, selectedSubject || undefined)
      .then(setArticles)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getGrades().then(setGrades);
    getSubjects().then(setSubjects);
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [selectedGrade, selectedSubject]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">经验知识库</h1>
        <Button color="primary" variant="flat" onPress={() => navigate('/knowledge/create')}>
          <PlusIcon className="w-5 h-5" />
          分享经验
        </Button>
      </div>

      <div className="flex gap-3 mb-6 items-center flex-wrap">
        <select
          className="h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={selectedGrade}
          onChange={(e) => setSelectedGrade(e.target.value)}
        >
          <option value="">全部年级</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select
          className="h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
        >
          <option value="">全部学科</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Button variant="light" size="sm" onPress={() => { setSelectedGrade(''); setSelectedSubject(''); }}>
          清除筛选
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-blue-700 dark:text-blue-300">
          还没有经验分享，<button className="text-blue-700 underline font-medium" onClick={() => navigate('/knowledge/create')}>来写第一篇吧</button>。
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all"
              onClick={() => navigate(`/knowledge/${a.id}`)}
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-lg font-semibold">{a.title}</h2>
                <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0 ml-2">{a.created_at?.slice(0, 10)}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Chip size="sm" color="primary">{a.grade_name}</Chip>
                <Chip size="sm" color="success">{a.subject_name}</Chip>
                {a.author_name_display && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">by {a.author_name_display}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
