import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { Avatar, AvatarImage, AvatarFallback } from '@heroui/react/avatar';
import { Dropdown, DropdownTrigger, DropdownPopover, DropdownMenu, DropdownItem } from '@heroui/react/dropdown';
import { HandThumbUpIcon } from '@heroicons/react/24/outline';
import { getArticle, toggleArticleLike, createComment, toggleCommentLike, deleteComment } from '../api/knowledge';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { localize } from '../utils/lang';
import { renderMarkdown } from '../utils/markdown';
import MarkdownInput from '../components/MarkdownInput';

const AVATAR_COLORS = ['blue','green','red','purple','orange','indigo','emerald','sky','rose'];
const avatarUrl = (name) => {
  if (!name) return '';
  const idx = Math.abs(name.split('').reduce((a,c)=>a*31+c.charCodeAt(0),0)) % AVATAR_COLORS.length;
  return `/images/${AVATAR_COLORS[idx]}.jpg`;
};

// 剪贴板写入：优先 Clipboard API，非安全上下文（LAN http）回退 execCommand
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { lang, t } = useLang();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const viewed = useRef(null);
  const copiedTimer = useRef(null);

  const refresh = () => getArticle(id).then(setArticle);

  useEffect(() => {
    const viewedId = viewed.current;
    setLoading(true);
    getArticle(id).then((data) => {
      setArticle(data);
      if (viewedId !== id) {
        viewed.current = id;
        client.post(`/knowledge/articles/${id}/view/`).catch(() => {});
        if (user && data.embedding) {
          client.get('/auth/profile/').then((prof) => {
            const userEmb = prof.data.embedding?.vector || Array(32).fill(0);
            fetch('', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_emb: userEmb,
                items: [{ emb: data.embedding, heat: 2.0 + (data.views || 0) * 0.1 + (data.like_count || 0) * 0.3, clicked: true }],
              }),
            }).catch(() => {});
          }).catch(() => {});
        }
      }
    }).finally(() => setLoading(false));
    return () => clearTimeout(copiedTimer.current);
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

  const loc = localize(article, lang);
  const display = showOriginal ? { title: article.title, content: article.content } : loc;

  // 站内路径 + 完整链接（复制引用用当前显示语言的标题）
  const articlePath = `/knowledge/${article.id}`;
  const articleUrl = `${window.location.origin}${articlePath}`;
  const markCopied = () => {
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    setCommentSubmitting(true);
    try {
      await createComment(article.id, commentContent);
      setCommentContent('');
      await refresh();
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <div>
      {/* Gradient accent line */}
      <div className="h-1 w-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mb-6" />

      {/* Labels */}
      {article.labels?.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {article.labels.map((l) => (
            <span key={l.id} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">{l.name}</span>
          ))}
        </div>
      )}

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">{display.title}</h1>

      {/* 译文提示 + 切换原文/译文 */}
      {loc.translated && (
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
          <i className="bi bi-translate" />
          <span>{showOriginal ? '' : (lang === 'zh' ? '已为你翻译' : 'Translated for you')}</span>
          <button onClick={() => setShowOriginal(v => !v)} className="text-indigo-500 hover:underline">
            {showOriginal ? t('common.showTranslation') : t('common.showOriginal')}
          </button>
        </div>
      )}

      {/* Meta bar */}
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Avatar size="sm" className="w-6 h-6">
            <AvatarImage src={avatarUrl(article.author_name_display)} />
            <AvatarFallback className="text-xs">{article.author_name_display?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-gray-700 dark:text-gray-300">{article.author_name_display || '匿名'}</span>
        </div>
        <span>·</span>
        <span>{article.created_at?.slice(0, 10)}</span>
        <span>·</span>
        <span>{article.views} 次浏览</span>
        <button
          onClick={async () => {
            const res = await toggleArticleLike(article.id);
            setArticle({...article, is_liked: res.liked, like_count: res.count});
          }}
          className={`flex items-center gap-1 transition-all duration-200 ${
            article.is_liked ? 'text-rose-500' : 'hover:text-rose-400'
          }`}
        >
          <svg className={`w-4 h-4 ${article.is_liked ? 'fill-current' : ''}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none">
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
          </svg>
          {article.like_count}
        </button>

        {/* 复制链接 / Markdown 引用（粘到站内任何 Markdown 输入框即成为链接） */}
        <Dropdown>
          <DropdownTrigger>
            <button className={`flex items-center gap-1 transition-colors ${copied ? 'text-emerald-500' : 'hover:text-indigo-500'}`}>
              <i className={`bi ${copied ? 'bi-check-lg' : 'bi-link-45deg'}`} />
              {copied ? t('article.copied') : t('article.copy')}
            </button>
          </DropdownTrigger>
          <DropdownPopover>
            <DropdownMenu>
              <DropdownItem key="link" onPress={async () => { if (await copyText(articleUrl)) markCopied(); }}>
                <span className="flex items-center gap-2"><i className="bi bi-link-45deg" />{t('article.copyLink')}</span>
              </DropdownItem>
              <DropdownItem key="mention" onPress={async () => { if (await copyText(`[${display.title}](${articlePath})`)) markCopied(); }}>
                <span className="flex items-center gap-2"><i className="bi bi-markdown" />{t('article.copyMention')}</span>
              </DropdownItem>
            </DropdownMenu>
          </DropdownPopover>
        </Dropdown>
      </div>

      {/* Content */}
      <div className="md-body bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 hover:shadow-sm hover:border-gray-300 dark:hover:border-slate-700 transition-all duration-200 text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: renderMarkdown(display.content) }} />

      {/* Debug info */}
      {article.embedding && (
        <details className="mt-4 text-xs text-gray-400 cursor-pointer">
          <summary className="inline hover:text-gray-600 transition-colors">向量 (32维)</summary>
          <p className="mt-2 font-mono bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3 overflow-x-auto">
            [{article.embedding.map(v => v.toFixed(4)).join(', ')}]
          </p>
        </details>
      )}
      {article.heat !== null && article.heat !== undefined && (
        <p className="mt-2 text-xs text-gray-400">热度: {article.heat}</p>
      )}

      {/* Actions */}
      <hr className="border-gray-200 dark:border-gray-800 my-6" />
      <div className="flex items-center gap-2 mb-6">
        <Button className="inline bg-slate-800/50 transition-colors" variant="light" onPress={() => navigate(-1)}>返回</Button>
        {user?.is_staff && (
          <Button
            className="bg-red-500 text-white hover:bg-red-600"
            onPress={async () => {
              if (!window.confirm('确认删除这篇文章？')) return;
              try {
                await client.delete(`/knowledge/articles/${id}/`);
                navigate('/');
              } catch {}
            }}
          >删除</Button>
        )}
      </div>

      {/* 写评论 */}
      <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm mb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('comments.write')}</h3>
        <form onSubmit={handleComment}>
          <div className="mb-4">
            <MarkdownInput
              placeholder={user ? t('comments.placeholder') : t('comments.loginToComment')}
              value={commentContent}
              onChange={setCommentContent}
              disabled={!user}
              rows={3}
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" color="primary" isLoading={commentSubmitting} isDisabled={commentSubmitting || !user} className="font-medium">
              {commentSubmitting ? t('comments.submitting') : t('comments.submit')}
            </Button>
            {!user && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">{t('top.login')}</Link>
              </p>
            )}
          </div>
        </form>
      </div>

      {/* 评论列表 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          {t('comments.title')}
          <span className="text-sm font-normal bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
            {article.comments?.length || 0}
          </span>
        </h2>

        {(!article.comments || article.comments.length === 0) && (
          <div className="bg-gray-50 dark:bg-slate-800/30 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('comments.empty')}</p>
          </div>
        )}

        <div className="space-y-3">
          {article.comments?.map((c) => (
            <CommentCard key={c.id} comment={c} article={article} user={user} t={t}
              onToggleLike={async (commentId) => {
                const res = await toggleCommentLike(commentId);
                const updateItem = (items) => items.map(x => ({
                  ...x,
                  is_liked: x.id === commentId ? res.liked : x.is_liked,
                  like_count: x.id === commentId ? res.count : x.like_count,
                  replies: x.replies ? updateItem(x.replies) : x.replies,
                }));
                setArticle({...article, comments: updateItem(article.comments)});
              }}
              onChanged={refresh}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CommentCard({ comment, article, user, t, onToggleLike, onChanged }) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSending(true);
    try {
      await createComment(article.id, replyContent, comment.id);
      setReplyContent('');
      setShowReply(false);
      onChanged();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-xl p-5 transition-all duration-200 hover:border-gray-300 dark:hover:border-slate-700">
      {/* Content */}
      <div className="md-body text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.content) }} />

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
        <span className="font-medium text-gray-700 dark:text-gray-300">{comment.author_name || '匿名'}</span>
        <span>{comment.created_at?.slice(0, 16).replace('T', ' ')}</span>
        <button
          onClick={() => onToggleLike(comment.id)}
          className={`flex items-center gap-1 transition-all duration-200 ${
            comment.is_liked ? 'text-rose-500' : 'hover:text-rose-400'
          }`}
        >
          <HandThumbUpIcon className={`w-3.5 h-3.5 ${comment.is_liked ? 'fill-current' : ''}`} />
          {comment.like_count || 0}
        </button>
        <button
          onClick={() => setShowReply(!showReply)}
          className="hover:text-indigo-500 transition-colors font-medium"
        >
          {t('comments.reply')}
        </button>
        {user?.is_staff && (
          <button
            onClick={async () => {
              if (!window.confirm(t('comments.confirmDelete'))) return;
              try {
                await deleteComment(article.id, comment.id);
                onChanged();
              } catch {}
            }}
            className="hover:text-rose-500 transition-colors font-medium ml-auto"
          >
            {t('comments.delete')}
          </button>
        )}
      </div>

      {/* Reply Form */}
      {showReply && (
        <form onSubmit={handleReply} className="mt-3 space-y-2 animate-slide-up">
          <MarkdownInput
            compact
            placeholder={t('comments.replyPlaceholder')}
            value={replyContent}
            onChange={setReplyContent}
            disabled={!user}
            rows={2}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" color="primary" isLoading={sending} isDisabled={!user || !replyContent.trim()}>
              {t('comments.reply')}
            </Button>
          </div>
        </form>
      )}

      {/* Nested Replies */}
      {comment.replies?.length > 0 && (
        <div className="mt-4 ml-4 pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/50 space-y-3">
          {comment.replies.map((r) => (
            <CommentCard key={r.id} comment={r} article={article} user={user} t={t}
              onToggleLike={onToggleLike} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}
