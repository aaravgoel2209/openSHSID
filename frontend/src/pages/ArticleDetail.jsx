import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { Chip } from '@heroui/react/chip';
import { getArticle } from '../api/knowledge';
import client from '../api/client';

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const viewed = useRef(null);

  useEffect(() => {
    setLoading(true);
    getArticle(id)
      .then(setArticle)
      .finally(() => setLoading(false));
    if (viewed.current !== id) {
      viewed.current = id;
      client.post(`/knowledge/articles/${id}/view/`).catch(() => {});
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!article) {
    return <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">文章不存在。</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <Chip size="sm" color="primary" className="mr-2">{article.grade_name}</Chip>
        <Chip size="sm" color="success" className="mr-2">{article.subject_name}</Chip>
        {article.author_name_display && (
          <span className="text-sm text-gray-500 ml-1">by {article.author_name_display}</span>
        )}
      </div>
      <h1 className="text-2xl font-bold mb-2">{article.title}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {article.created_at?.slice(0, 16).replace('T', ' ')}
        {' · '}
        {article.views} 次浏览
      </p>
      <hr className="border-gray-200 mb-6" />
      <p className="text-gray-700 whitespace-pre-wrap">{article.content}</p>
      <hr className="border-gray-200 my-6" />
      <Button variant="light" onPress={() => navigate('/knowledge')}>返回知识库</Button>
    </div>
  );
}
