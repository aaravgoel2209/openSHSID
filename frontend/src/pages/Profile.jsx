import { useContext, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { Button } from '@heroui/react/button';
import { ChatBubbleLeftRightIcon, BookOpenIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { getQuestions } from '../api/qa';
import { getArticles } from '../api/knowledge';

const AVATAR_COLORS = ['blue','green','red','purple','orange','indigo','emerald','sky','rose'];

function getAvatarColor(username) {
  const hash = Math.abs(username.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
  return AVATAR_COLORS[hash % 9];
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading } = useContext(AuthContext);
  const [myQuestions, setMyQuestions] = useState([]);
  const [myArticles, setMyArticles] = useState([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([getQuestions(), getArticles()]).then(([qs, as]) => {
      setMyQuestions(qs.filter((q) => q.author === user.id));
      setMyArticles(as.filter((a) => a.author === user.id));
      setFetched(true);
    });
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-400">加载中...</p>
      </div>
    );
  }

  if (!user) {
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

  return (
    <div className="animate-fade-in">
      {/* Profile Header Card */}
      <div className="relative bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden mb-8 shadow-sm">
        {/* Gradient Banner */}
        <div className="h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-90" />

        {/* Avatar & Info */}
        <div className="px-6 pb-5">
          <div className="flex items-end gap-4 -mt-10">
            <div className="w-20 h-20 rounded-2xl border-4 border-white dark:border-slate-900 overflow-hidden shadow-lg">
              <img
                src={`/images/${getAvatarColor(user.username)}.jpg`}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="pb-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{user.username}</h1>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>加入于 {user.date_joined?.slice(0, 10)}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-5 pt-4 border-t border-gray-100 dark:border-slate-800">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{myQuestions.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">提问</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{myArticles.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">文章</p>
            </div>
          </div>
        </div>
      </div>

      {/* My Questions */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <ChatBubbleLeftRightIcon className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">我的提问</h2>
        </div>
        {!fetched ? (
          <div className="flex justify-center py-6"><Spinner size="sm" /></div>
        ) : myQuestions.length === 0 ? (
          <div className="bg-gray-50 dark:bg-slate-800/30 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">还没有提问过</p>
            <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={() => navigate('/qa/ask')}>
              去提问
            </Button>
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">我的文章</h2>
        </div>
        {!fetched ? (
          <div className="flex justify-center py-6"><Spinner size="sm" /></div>
        ) : myArticles.length === 0 ? (
          <div className="bg-gray-50 dark:bg-slate-800/30 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">还没有发表文章</p>
            <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={() => navigate('/knowledge/create')}>
              写文章
            </Button>
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
