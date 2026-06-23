import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Spinner } from '@heroui/react/spinner';
import { Button } from '@heroui/react/button';
import { ChatBubbleLeftRightIcon, BookOpenIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { getQuestions } from '../api/qa';
import { getArticles } from '../api/knowledge';
import client from '../api/client';
import Card from '../components/Card';
import { useUI } from '../context/UIContext';

import { getAvatarColor } from '../utils/avatar';

export default function Profile() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user, loading } = useContext(AuthContext);
  const { hasGlass } = useUI();
  const isOwn = !userId || (user && String(user.id) === String(userId));

  const [profile, setProfile] = useState(isOwn ? user : null);
  const [profileLoading, setProfileLoading] = useState(!isOwn);
  const [myQuestions, setMyQuestions] = useState([]);
  const [myArticles, setMyArticles] = useState([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (isOwn) { setProfile(user); setProfileLoading(false); return; }
    setProfileLoading(true);
    client.get(`/auth/users/${userId}/`)
      .then((r) => setProfile(r.data))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [userId, isOwn, user]);

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
      <Card
        glass={hasGlass}
        padded={false}
        className="relative overflow-hidden mb-8 shadow-sm"
        motionProps={{
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3 },
        }}
      >
        {/* Gradient Banner */}
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-indigo-500 to-purple-600" />

        <div className="h-24 w-full" />

        {/* Avatar & Info */}
        <div className="relative z-10 px-6 pb-5">
          <div className="flex items-end gap-4 -mt-10">
            <div className="w-20 h-20 rounded-2xl border-4 border-white dark:border-slate-900 overflow-hidden shadow-lg">
              <img
                src={`/images/${getAvatarColor(profile.username)}.jpg`}
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
            <Card glass={hasGlass} padded={false} className="text-center overflow-hidden shadow-sm w-15 h-15">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{myQuestions.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">提问</p>
            </Card>
            <Card glass={hasGlass} padded={false} className="text-center overflow-hidden shadow-sm w-15 h-15">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{myArticles.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">文章</p>
            </Card>
          </div>
        </div>
      </Card>

      {/* Questions */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <ChatBubbleLeftRightIcon className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{labelPrefix}提问</h2>
        </div>
        {!fetched ? (
          <div className="flex justify-center py-6"><Spinner size="sm" /></div>
        ) : myQuestions.length === 0 ? (
          <Card glass={hasGlass} className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">还没有提问</p>
            {isOwn && (
              <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={() => navigate('/qa/ask')}>
                去提问
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {myQuestions.map((q, index) => (
              <Card
                key={q.id}
                glass={hasGlass}
                clickable
                className="group"
                motionProps={{
                  initial: { opacity: 0, y: 8 },
                  animate: { opacity: 1, y: 0 },
                  transition: { delay: index * 0.03, type: 'spring', stiffness: 300, damping: 30 },
                }}
                onClick={() => navigate(`/qa/questions/${q.id}`)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{q.title}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-3">{q.created_at?.slice(0, 10)}</span>
                </div>
              </Card>
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
          <Card glass={hasGlass} className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">还没有发表文章</p>
            {isOwn && (
              <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={() => navigate('/knowledge/create')}>
                写文章
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {myArticles.map((a, index) => (
              <Card
                key={a.id}
                glass={hasGlass}
                clickable
                className="group"
                motionProps={{
                  initial: { opacity: 0, y: 8 },
                  animate: { opacity: 1, y: 0 },
                  transition: { delay: index * 0.03, type: 'spring', stiffness: 300, damping: 30 },
                }}
                onClick={() => navigate(`/knowledge/${a.id}`)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{a.title}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-3">{a.created_at?.slice(0, 10)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
