import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import client from '../api/client';
import '../styles/Admin.css';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.is_staff) {
      navigate('/');
      return;
    }

    client.get('/auth/admin/dashboard/')
      .then((r) => setStats(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  if (!user?.is_staff) return null;

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>管理面板</h1>
        <p>系统统计和管理工具</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : stats ? (
        <div className="admin-content">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{stats.total_users}</div>
              <div className="stat-label">总用户数</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.total_questions}</div>
              <div className="stat-label">总问题数</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.total_answers}</div>
              <div className="stat-label">总回答数</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.total_articles}</div>
              <div className="stat-label">总文章数</div>
            </div>
          </div>

          <div className="admin-menu">
            <button
              className="admin-btn"
              onClick={() => navigate('/admin/users')}
            >
              👥 用户管理
            </button>
            <button
              className="admin-btn"
              onClick={() => navigate('/admin/content')}
            >
              📝 内容管理
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
