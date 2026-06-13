import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { TextField } from '@heroui/react/textfield';
import { Label } from '@heroui/react/label';
import { Input } from '@heroui/react/input';
import { TextArea } from '@heroui/react/textarea';
import { getLabels } from '../api/labels';
import client from '../api/client';

export default function CreateArticle() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [allLabels, setAllLabels] = useState([]);
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getLabels().then(setAllLabels).catch(() => {});
  }, []);

  const toggleLabel = (id) => {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      const a = await client.post('/knowledge/articles/', {
        title,
        content,
        author_name: authorName,
        labels: selectedLabels,
      }).then((r) => r.data);
      navigate(`/knowledge/${a.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">分享经验</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField>
          <Label>标题</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </TextField>
        <TextField>
          <Label>作者（选填）</Label>
          <Input placeholder="你的名字或昵称" value={authorName} onChange={(e) => setAuthorName(e.target.value)} maxLength={100} />
        </TextField>
        <TextField>
          <Label>内容</Label>
          <TextArea value={content} onChange={(e) => setContent(e.target.value)} minRows={12} />
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
        <div className="flex gap-2">
          <Button type="submit" color="primary" isLoading={submitting}>
            {submitting ? '发布中...' : '发布'}
          </Button>
          <Button variant="light" onPress={() => navigate('/knowledge')}>取消</Button>
        </div>
      </form>
    </div>
  );
}
