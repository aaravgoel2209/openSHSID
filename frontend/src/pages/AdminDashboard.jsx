import { motion } from 'framer-motion';
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { AuthContext } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Card from '../components/Card';

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function AdminDashboard() {
  const { user, token } = useContext(AuthContext);
  const { hasGlass } = useUI();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.is_staff) { navigate('/'); return; }
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/auth/admin/dashboard/', {
          headers: { 'Authorization': `Token ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch stats');
        setStats(await response.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user, token, navigate]);

  if (!user?.is_staff) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-5xl mx-auto px-4 py-6"
    >
      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-gray-200 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">管理面板</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">系统统计和管理工具</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : stats ? (
        <div>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            {[
              { num: stats.total_users, label: '总用户数', icon: '👥' },
              { num: stats.total_questions, label: '总问题数', icon: '💬' },
              { num: stats.total_answers, label: '总回答数', icon: '📝' },
              { num: stats.total_articles, label: '总文章数', icon: '📚' },
            ].map((s) => (
              <motion.div key={s.label} variants={item}>
                <Card glass={hasGlass} padded className="text-center">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">{s.num}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{s.label}</div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={item}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/admin/users')}
                className="w-full"
              >
                <Card glass={hasGlass} padded hoverable className="text-center">
                  <div className="text-3xl mb-2">👥</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">用户管理</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">查看、编辑和管理用户</div>
                </Card>
              </motion.button>
            </motion.div>
            <motion.div variants={item}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/admin/content')}
                className="w-full"
              >
                <Card glass={hasGlass} padded hoverable className="text-center">
                  <div className="text-3xl mb-2">📝</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">内容管理</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">管理问题、回答和文章</div>
                </Card>
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      ) : null}
    </motion.div>
  );
}
