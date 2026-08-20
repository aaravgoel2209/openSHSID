import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { ArrowLeftIcon, EyeIcon, HandThumbUpIcon } from '@heroicons/react/24/outline';
import {
  getPost, viewPost, togglePostLike, deletePost,
  createComment, deleteComment, toggleCommentLike,
} from '../api/postbar';
import { AuthContext } from '../context/authContext';
import MarkdownView from '../components/MarkdownView';
import MarkdownInput from '../components/MarkdownInput';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const viewed = useRef(null);

  const fetchData = () => {
    getPost(id).then(setPost).finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
    if (viewed.current !== id) {
      viewed.current = id;
      viewPost(id).catch(() => {});
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await createComment(id, content);
      setContent('');
      setPost(await getPost(id));
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

  if (!post) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <p className="text-gray-600 dark:text-gray-400 mb-3">帖子不存在</p>
        <Button variant="flat" size="sm" onPress={() => navigate('/postbar')}>返回贴吧</Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate(post.subbar ? `/postbar/b/${post.subbar}` : '/postbar')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        {post.subbar_name ? `返回 ${post.subbar_name}` : '返回贴吧'}
      </button>

      {/* Post Card */}
      <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 mb-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">{post.title}</h1>

        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-5">
          <span className="font-medium text-gray-700 dark:text-gray-300">{post.author_name || '匿名'}</span>
          <span>{post.created_at?.slice(0, 16).replace('T', ' ')}</span>
          <span className="flex items-center gap-1"><EyeIcon className="w-4 h-4" />{post.views}</span>
          <button
            onClick={async () => {
              const res = await togglePostLike(post.id);
              setPost({ ...post, is_liked: res.liked, like_count: res.count });
            }}
            className={`flex items-center gap-1 transition-all duration-200 ${post.is_liked ? 'text-rose-500' : 'hover:text-rose-400'}`}
          >
            <HandThumbUpIcon className={`w-4 h-4 ${post.is_liked ? 'fill-current' : ''}`} />
            {post.like_count}
          </button>
          {post.can_manage && (
            <button
              onClick={async () => {
                if (!window.confirm('确认删除这个帖子？')) return;
                try {
                  await deletePost(post.id);
                  navigate(post.subbar ? `/postbar/b/${post.subbar}` : '/postbar');
                } catch { /* 删除失败则停留在原地 —— confirm 已拦截误触，无额外提示 */ }
              }}
              className="flex items-center gap-1 text-gray-400 hover:text-rose-500 transition-colors ml-auto"
            >
              <i className="bi bi-trash" />
              删除帖子
            </button>
          )}
        </div>

        <MarkdownView className="md-body text-gray-700 dark:text-gray-300" markdown={post.content} />
      </div>

      {/* Comment box */}
      <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm mb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">写回复</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <MarkdownInput
              placeholder={user ? '写下你的回复...' : '登录后可回复'}
              value={content}
              onChange={setContent}
              required
              disabled={!user}
              rows={4}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" color="primary" isLoading={submitting} isDisabled={submitting || !user} className="font-medium">
              {submitting ? '提交中...' : '提交回复'}
            </Button>
            {!user && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">登录</Link>
                后可以回复
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Comments */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          回复
          <span className="text-sm font-normal bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
            {post.comments?.length || 0}
          </span>
        </h2>

        {post.comments?.length === 0 && (
          <div className="bg-gray-50 dark:bg-slate-800/30 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">暂无回复，来抢沙发吧</p>
          </div>
        )}

        <div className="space-y-3">
          {post.comments?.map((c) => (
            <CommentCard key={c.id} comment={c} post={post} user={user}
              onToggleLike={async (commentId) => {
                const res = await toggleCommentLike(commentId);
                const updateItem = (items) => items.map((x) => ({
                  ...x,
                  is_liked: x.id === commentId ? res.liked : x.is_liked,
                  like_count: x.id === commentId ? res.count : x.like_count,
                  replies: x.replies ? updateItem(x.replies) : x.replies,
                }));
                setPost({ ...post, comments: updateItem(post.comments) });
              }}
              onChanged={fetchData}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CommentCard({ comment, post, user, onToggleLike, onChanged }) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSending(true);
    try {
      await createComment(post.id, replyContent, comment.id);
      setReplyContent('');
      setShowReply(false);
      onChanged();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-xl p-5 transition-all duration-200 hover:border-gray-300 dark:hover:border-slate-700">
      <MarkdownView className="md-body text-gray-800 dark:text-gray-200" markdown={comment.content} />

      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
        <span className="font-medium text-gray-700 dark:text-gray-300">{comment.author_name || '匿名'}</span>
        <span>{comment.created_at?.slice(0, 16).replace('T', ' ')}</span>
        <button
          onClick={() => onToggleLike(comment.id)}
          className={`flex items-center gap-1 transition-all duration-200 ${comment.is_liked ? 'text-rose-500' : 'hover:text-rose-400'}`}
        >
          <HandThumbUpIcon className={`w-3.5 h-3.5 ${comment.is_liked ? 'fill-current' : ''}`} />
          {comment.like_count || 0}
        </button>
        <button onClick={() => setShowReply(!showReply)} className="hover:text-indigo-500 transition-colors font-medium">
          回复
        </button>
        {post.can_manage && (
          <button
            onClick={async () => {
              if (!window.confirm('确认删除这条回复？')) return;
              try {
                await deleteComment(post.id, comment.id);
                onChanged();
              } catch { /* 删除失败则回复保留 —— confirm 已拦截误触，无额外提示 */ }
            }}
            className="hover:text-rose-500 transition-colors font-medium ml-auto"
          >
            删除
          </button>
        )}
      </div>

      {showReply && (
        <form onSubmit={handleReply} className="mt-3 space-y-2 animate-slide-up">
          <MarkdownInput compact placeholder="写下回复..." value={replyContent} onChange={setReplyContent} disabled={!user} rows={2} />
          <div className="flex justify-end">
            <Button type="submit" size="sm" color="primary" isLoading={sending} isDisabled={!user || !replyContent.trim()}>
              回复
            </Button>
          </div>
        </form>
      )}

      {comment.replies?.length > 0 && (
        <div className="mt-4 ml-4 pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/50 space-y-3">
          {comment.replies.map((r) => (
            <CommentCard key={r.id} comment={r} post={post} user={user} onToggleLike={onToggleLike} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}
