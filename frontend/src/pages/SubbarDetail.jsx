import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { TextField } from '@heroui/react/textfield';
import { Label } from '@heroui/react/label';
import { Input } from '@heroui/react/input';
import { ArrowLeftIcon, PlusIcon, ChatBubbleLeftRightIcon, EyeIcon, HandThumbUpIcon } from '@heroicons/react/24/outline';
import { getSubbar, getSubbarPosts, createPost } from '../api/postbar';
import { AuthContext } from '../context/authContext';
import { useToast } from '../context/useToast';
import { useLang } from '../context/useLang';
import MarkdownInput from '../components/MarkdownInput';

export default function SubbarDetail() {
  const { subbarId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const { t } = useLang();
  const [subbar, setSubbar] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([getSubbar(subbarId), getSubbarPosts(subbarId)])
      .then(([s, p]) => { setSubbar(s); setPosts(p); })
      .catch(() => setSubbar(null))
      .finally(() => setLoading(false));
  };
  useEffect(load, [subbarId]);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const post = await createPost(subbarId, title.trim(), content);
      showToast({
        message: t('toast.postPublished'),
        type: 'success',
        action: { label: t('toast.view'), onPress: () => navigate(`/postbar/posts/${post.id}`) },
      });
      navigate(`/postbar/posts/${post.id}`);
    } catch (err) {
      if (err?.response?.status === 401) setError('请先登录后再发帖');
      else setError(err?.response?.data?.error || '发帖失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-400">加载中...</p>
      </div>
    );
  }

  if (!subbar) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <p className="text-gray-600 dark:text-gray-400 mb-3">这个吧不存在</p>
        <Button variant="flat" size="sm" onPress={() => navigate('/postbar')}>返回贴吧</Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate('/postbar')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        返回贴吧
      </button>

      {/* Subbar header */}
      <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 mb-6 shadow-sm flex items-start gap-4">
        <div className="shrink-0 w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-500 font-bold text-2xl">
          {subbar.name?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{subbar.name}</h1>
          {subbar.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subbar.description}</p>}
          <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
            <span>{subbar.post_count} 帖</span>
            {subbar.creator_name && <span>吧主 {subbar.creator_name}</span>}
          </div>
        </div>
        <Button color="primary" variant="shadow" onPress={() => setComposing((v) => !v)} className="font-medium shrink-0">
          <PlusIcon className="w-4 h-4" />
          发帖
        </Button>
      </div>

      {/* Compose post */}
      {composing && (
        <form onSubmit={handlePost} className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 mb-6 shadow-sm flex flex-col gap-4 animate-slide-up">
          {!user && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              请先<Link to="/login" className="font-semibold underline">登录</Link>后再发帖。
            </p>
          )}
          <TextField>
            <Label>标题</Label>
            <Input placeholder="一句话标题" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </TextField>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">正文</p>
            <MarkdownInput placeholder="写下你想说的..." value={content} onChange={setContent} disabled={!user} rows={5} />
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" color="primary" isLoading={submitting} isDisabled={submitting || !user || !title.trim() || !content.trim()}>
              {submitting ? '发布中...' : '发布'}
            </Button>
            <Button variant="light" onPress={() => setComposing(false)}>取消</Button>
          </div>
        </form>
      )}

      {/* Posts list */}
      {posts.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-3">还没有帖子</p>
          <Button color="primary" variant="flat" size="sm" onPress={() => setComposing(true)}>
            来发第一帖
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p, index) => (
            <div
              key={p.id}
              className="group bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-xl p-5 cursor-pointer hover-lift hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-all duration-200"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => navigate(`/postbar/posts/${p.id}`)}
            >
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                {p.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{p.content}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">{p.author_name || '匿名'}</span>
                <span>{p.created_at?.slice(0, 10)}</span>
                <span className="flex items-center gap-1"><ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />{p.comment_count}</span>
                <span className="flex items-center gap-1"><EyeIcon className="w-3.5 h-3.5" />{p.views}</span>
                <span className="flex items-center gap-1"><HandThumbUpIcon className="w-3.5 h-3.5" />{p.like_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
