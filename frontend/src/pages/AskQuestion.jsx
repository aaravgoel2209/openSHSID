import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
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
      navigate(`/questions/${q.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">提问</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="标题"
          placeholder="一句话概括你的问题"
          value={title}
          onValueChange={setTitle}
          isRequired
          maxLength={200}
        />
        <TextArea
          label="详细内容"
          placeholder="补充问题细节..."
          value={content}
          onValueChange={setContent}
          isRequired
          minRows={5}
        />
        <div className="flex gap-2">
          <Button type="submit" color="primary" isLoading={submitting}>
            {submitting ? '发布中...' : '发布问题'}
          </Button>
          <Button variant="light" onPress={() => navigate('/')}>取消</Button>
        </div>
      </form>
    </div>
  );
}
