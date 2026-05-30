import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { TextArea } from '@heroui/react/textarea';
import { getGrades, getSubjects, createArticle } from '../api/knowledge';

export default function CreateArticle() {
  const navigate = useNavigate();
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getGrades().then(setGrades);
    getSubjects().then(setSubjects);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !grade || !subject) return;
    setSubmitting(true);
    try {
      const a = await createArticle({
        title,
        content,
        grade: parseInt(grade),
        subject: parseInt(subject),
        author_name: authorName,
      });
      navigate(`/knowledge/${a.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">分享经验</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="标题"
          value={title}
          onValueChange={setTitle}
          isRequired
          maxLength={200}
        />
        <div className="flex gap-4">
          <select
            className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            required
          >
            <option value="">选择年级</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <select
            className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          >
            <option value="">选择学科</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <Input
          label="作者（选填）"
          placeholder="你的名字或昵称"
          value={authorName}
          onValueChange={setAuthorName}
          maxLength={100}
        />
        <TextArea
          label="内容"
          isRequired
          value={content}
          onValueChange={setContent}
          minRows={10}
        />
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
