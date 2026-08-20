import { useState, useEffect } from 'react';
import { Spinner } from '@heroui/react/spinner';
import client from '../api/client';

export default function MemoryView() {
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
    <div>
      <h1 className="text-xl font-bold mb-4">模型记忆</h1>
      {items.length === 0 ? (
        <p className="text-gray-500">暂无记忆。</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">ID={item.id}</div>
              <div className="font-medium text-sm mb-1">{item.title}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap line-clamp-3">{item.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
