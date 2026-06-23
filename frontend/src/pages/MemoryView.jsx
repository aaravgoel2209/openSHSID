import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Spinner } from '@heroui/react/spinner';
import { useUI } from '../context/UIContext';
import Card from '../components/Card';
import client from '../api/client';

export default function MemoryView() {
  const navigate = useNavigate();
  const { hasGlass } = useUI();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/knowledge/memory/')
      .then((r) => setItems(r.data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner size="lg" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate('/admin')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-4"
      >
        ← 返回管理面板
      </button>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">模型记忆</h1>
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">暂无记忆。</div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.2 }}
            >
              <Card glass={hasGlass} padded>
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-1 font-mono">ID={item.id}</div>
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1">{item.title}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap line-clamp-3">{item.content}</div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
