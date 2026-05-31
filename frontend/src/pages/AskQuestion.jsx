import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { TextField } from '@heroui/react/textfield';
import { Label } from '@heroui/react/label';
import { Input } from '@heroui/react/input';
import { TextArea } from '@heroui/react/textarea';
import { createQuestion } from '../api/qa';

export default function AskQuestion() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      const q = await createQuestion(title, content);
      navigate(`/qa/questions/${q.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">提问</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        <div className="flex gap-2 pt-2">
          <Button type="submit" color="primary" isLoading={submitting}>
            {submitting ? '发布中...' : '发布问题'}
          </Button>
          <Button variant="light" onPress={() => navigate('/qa')}>取消</Button>
        </div>
      </form>
    </div>
  );
}
