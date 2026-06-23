import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { Button } from '@heroui/react/button';
import { ChatBubbleLeftRightIcon, BookOpenIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { getQuestions } from '../api/qa';
import { getArticles } from '../api/knowledge';
import client from '../api/client';

const AVATAR_COLORS = ['blue','green','red','purple','orange','indigo','emerald','sky','rose'];

function getAvatarColor(username) {
  const hash = Math.abs((username || '').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
  return AVATAR_COLORS[hash % 9];
}

export default function Profile() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user, loading } = useContext(AuthContext);
  // 无 userId 或就是自己 → 个人中心；否则 → 查看他人主页
  const isOwn = !userId || (user && String(user.id) === String(userId));

  const [profile, setProfile] = useState(isOwn ? user : null);
  const [profileLoading, setProfileLoading] = useState(!isOwn);
  const [myQuestions, setMyQuestions] = useState([]);
  const [myArticles, setMyArticles] = useState([]);
  const [fetched, setFetched] = useState(false);

  // 目标用户资料：自己用 context，他人则拉取公开资料
  useEffect(() => {
    if (isOwn) { setProfile(user); setProfileLoading(false); return; }
    setProfileLoading(true);
    client.get(`/auth/users/${userId}/`)
      .then((r) => setProfile(r.data))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [userId, isOwn, user]);

  // 目标用户的提问 / 文章
  useEffect(() => {
    const targetId = isOwn ? user?.id : Number(userId);
    if (targetId == null || Number.isNaN(targetId)) return;
    setFetched(false);
    Promise.all([getQuestions(), getArticles()]).then(([qs, as]) => {
      setMyQuestions(qs.filter((q) => q.author === targetId));
      setMyArticles(as.filter((a) => a.author === targetId));
      setFetched(true);
    }).catch(() => setFetched(true));
  }, [userId, isOwn, user]);

  if (loading || profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-400">加载中...</p>
      </div>
    );
  }

  // 自己的个人中心但未登录 → 登录提示
  if (isOwn && !user) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-yellow-50 dark:bg-yellow-950/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-3">请先登录后查看个人中心</p>
        <Button color="primary" variant="flat" size="sm" onPress={() => navigate('/login')}>
          去登录
        </Button>
      </div>
    );
  }

  // 查看他人但用户不存在
  if (!profile) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-2xl">🚫</div>
        <p className="text-gray-600 dark:text-gray-400 mb-3">用户不存在</p>
        <Button variant="flat" size="sm" onPress={() => navigate(-1)}>返回</Button>
      </div>
    );
  }

  const labelPrefix = isOwn ? '我的' : `${profile.username} 的`;

  return (
    <div className="animate-fade-in">
      {/* Profile Header Card */}
      <div className="relative border border-gray-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden mb-8 shadow-sm">
        {/* Gradient Banner */}
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-indigo-500 to-purple-600" />

        {/* 2. 占位层：因为渐变脱离文档流，必须保留这 24 的高度，防止头像上移 */}
        <div className="h-24 w-full" />

        {/* Avatar & Info */}
        <div className="relative z-10 px-6 pb-5">
          <div className="flex items-end gap-4 -mt-10">
            <div className="w-20 h-20 rounded-2xl border-4 border-white dark:border-slate-900 overflow-hidden shadow-lg">
              <img
                src={profile.avatar || `/images/${getAvatarColor(profile.username)}.jpg`}
                alt={profile.username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="pb-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{profile.username}</h1>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>加入于 {profile.date_joined?.slice(0, 10)}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span>文章 <strong>{profile.article_count || 0}</strong></span>
                <span>回答 <strong>{profile.answer_count || 0}</strong></span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-5 pt-4 border-t border-gray-100 dark:border-slate-800">
            <div className="relative h-15 w-15 bg-white dark:bg-slate-900/75 border text-center rounded-2xl overflow-hidden mb-8 shadow-sm">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{myQuestions.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">提问</p>
            </div>
            <div className="relative h-15 w-15 bg-white dark:bg-slate-900/75 border text-center rounded-2xl overflow-hidden mb-8 shadow-sm">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{myArticles.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">文章</p>
            </div>
          </div>
        </div>
      </div>

      {/* Questions */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <ChatBubbleLeftRightIcon className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{labelPrefix}提问</h2>
        </div>
        {!fetched ? (
          <div className="flex justify-center py-6"><Spinner size="sm" /></div>
        ) : myQuestions.length === 0 ? (
          <div className="bg-gray-50 dark:bg-slate-800/30 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">还没有提问</p>
            {isOwn && (
              <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={() => navigate('/qa/ask')}>
                去提问
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {myQuestions.map((q) => (
              <div
                key={q.id}
                className="group bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-xl p-4 cursor-pointer hover-lift hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-all duration-200"
                onClick={() => navigate(`/qa/questions/${q.id}`)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{q.title}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-3">{q.created_at?.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My Articles */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpenIcon className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{labelPrefix}文章</h2>
        </div>
        {!fetched ? (
          <div className="flex justify-center py-6"><Spinner size="sm" /></div>
        ) : myArticles.length === 0 ? (
          <div className="bg-gray-50 dark:bg-slate-800/30 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">还没有发表文章</p>
            {isOwn && (
              <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={() => navigate('/knowledge/create')}>
                写文章
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {myArticles.map((a) => (
              <div
                key={a.id}
                className="group bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-xl p-4 cursor-pointer hover-lift hover:border-purple-200 dark:hover:border-purple-800/60 transition-all duration-200"
                onClick={() => navigate(`/knowledge/${a.id}`)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{a.title}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-3">{a.created_at?.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
