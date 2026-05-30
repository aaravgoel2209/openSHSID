import { useContext, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { AuthContext } from '../context/AuthContext';
import { getQuestions } from '../api/qa';
import { getArticles } from '../api/knowledge';

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
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-yellow-700 dark:text-yellow-300">
        请先<Link to="/login" className="text-yellow-700 dark:text-yellow-300 underline font-medium">登录</Link>。
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">个人中心</h1>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6 shadow-sm">
        <h2 className="text-lg font-semibold">{user.username}</h2>
        <p className="text-sm text-gray-500">加入时间：{user.date_joined?.slice(0, 10)}</p>
      </div>

      <h2 className="text-xl font-semibold mb-3">我的提问</h2>
      {!fetched ? (
        <div className="flex justify-center py-4"><Spinner size="sm" /></div>
      ) : myQuestions.length === 0 ? (
        <p className="text-gray-500 mb-4">还没有提问过。</p>
      ) : (
        <div className="space-y-2 mb-6">
          {myQuestions.map((q) => (
            <div
              key={q.id}
              className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-primary-300 transition-all"
              onClick={() => navigate(`/questions/${q.id}`)}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{q.title}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{q.created_at?.slice(0, 10)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-xl font-semibold mb-3">我的文章</h2>
      {!fetched ? (
        <div className="flex justify-center py-4"><Spinner size="sm" /></div>
      ) : myArticles.length === 0 ? (
        <p className="text-gray-500">还没有发表文章。</p>
      ) : (
        <div className="space-y-2">
          {myArticles.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 transition-all"
              onClick={() => navigate(`/knowledge/${a.id}`)}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{a.title}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{a.created_at?.slice(0, 10)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
