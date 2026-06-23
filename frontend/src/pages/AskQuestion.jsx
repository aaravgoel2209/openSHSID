import { motion } from 'framer-motion';
import { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { TextField } from '@heroui/react/textfield';
import { Label } from '@heroui/react/label';
import { Input } from '@heroui/react/input';
import { TextArea } from '@heroui/react/textarea';
import { createQuestion } from '../api/qa';
import { getLabels } from '../api/labels';
import { AuthContext } from '../context/AuthContext';
import client from '../api/client';
import Card from '../components/Card';
import { useUI } from '../context/UIContext';


export default function AskQuestion() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { hasGlass } = useUI();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [allLabels, setAllLabels] = useState([]);
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getLabels().then(setAllLabels).catch(() => {}); }, []);

  const toggleLabel = (id) => {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { setError('请先登录后再发布问题'); return; }
    if (!title.trim() || !content.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const q = await client.post('/qa/questions/', { title, content, labels: selectedLabels }).then((r) => r.data);
      navigate(`/qa/questions/${q.id}`);
    } catch (err) {
      if (err?.response?.status === 401) setError('请先登录后再发布问题');
      else setError(err?.response?.data?.error || '发布失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">提问</h1>
      {!user && (
        <div className="mb-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30 p-4 text-sm text-yellow-700 dark:text-yellow-300">
          请先<Link to="/login" className="font-semibold underline">登录</Link>后再发布问题。
        </div>
      )}
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onSubmit={handleSubmit}
      >
        <Card glass={hasGlass} className="flex flex-col gap-4">
          <TextField>
            <Label>标题</Label>
            <Input
              placeholder="一句话概括你的问题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </TextField>
          <TextField>
            <Label>详细内容</Label>
            <TextArea
              placeholder="补充问题细节..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              minRows={5}
            />
          </TextField>
          {allLabels.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">标签</p>
              <div className="flex gap-2 flex-wrap">
                {allLabels.map((l) => (
                  <button key={l.id} type="button" onClick={() => toggleLabel(l.id)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      selectedLabels.includes(l.id)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-gray-100 dark:bg-slate-950 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-primary'
                    }`}
                  >{l.name}</button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button type="submit" color="primary" isLoading={submitting} isDisabled={submitting || !user}>
                {submitting ? '发布中...' : '发布问题'}
              </Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button variant="light" onPress={() => navigate('/qa')}>取消</Button>
            </motion.div>
          </div>
        </Card>
      </motion.form>
    </div>
  );
}
