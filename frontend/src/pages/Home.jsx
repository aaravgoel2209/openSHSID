import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { PlusIcon, ChatBubbleLeftRightIcon, EyeIcon, HandThumbUpIcon } from '@heroicons/react/24/outline';
import { useUI } from '../context/UIContext';
import Card from '../components/Card';
import { getQuestions } from '../api/qa';

export default function Home() {
  const navigate = useNavigate();
  const { hasGlass } = useUI();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuestions()
      .then(setQuestions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-400">加载中...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">所有问题</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{questions.length} 个问题</p>
        </div>
        <Button color="primary" variant="shadow" onPress={() => navigate('/qa/ask')} className="font-medium">
          <PlusIcon className="w-4 h-4" />
          提问
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-3">还没有问题</p>
          <Button color="primary" variant="flat" size="sm" onPress={() => navigate('/qa/ask')}>
            来提第一个问题吧
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, index) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, type: 'spring', stiffness: 300, damping: 30 }}
            >
              <Card
                glass={hasGlass}
                clickable
                onClick={() => navigate(`/qa/questions/${q.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {q.title}
                      </h2>
                      {q.labels?.map((l) => (
                        <span key={l.id} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium">
                          {l.name}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{q.author_name || '匿名'}</span>
                      <span>{q.created_at?.slice(0, 10)}</span>
                      <span className="flex items-center gap-1">
                        <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                        {q.answer_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <EyeIcon className="w-3.5 h-3.5" />
                        {q.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <HandThumbUpIcon className="w-3.5 h-3.5" />
                        {q.like_count}
                      </span>
                    </div>
                  </div>

                  {q.answer_count > 0 && (
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{q.answer_count}</span>
                      <span className="text-[9px] text-emerald-500 dark:text-emerald-500 -mt-0.5">回答</span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
