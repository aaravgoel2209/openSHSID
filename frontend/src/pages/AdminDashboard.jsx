import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/authContext';
import client from '../api/client';
import '../styles/Admin.css';

// 轻量内联柱状趋势图（无额外依赖）
function TrendChart({ data, color }) {
  if (!data?.length) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="trend-chart">
      <div className="trend-bars">
        {data.map((d) => (
          <div key={d.date} className="trend-bar-wrap" title={`${d.date}: ${d.count}`}>
            <div
              className="trend-bar"
              style={{ height: `${(d.count / max) * 100}%`, background: color }}
            />
          </div>
        ))}
      </div>
      <div className="trend-foot">
        <span>{data[0].date.slice(5)}</span>
        <span className="trend-total">共 {total}</span>
        <span>{data[data.length - 1].date.slice(5)}</span>
      </div>
    </div>
  );
}

function BreakdownBars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  const palette = ['#007bff', '#6f42c1', '#20c997', '#fd7e14', '#e83e8c', '#17a2b8'];
  return (
    <div className="breakdown">
      {items.map((it, idx) => (
        <div key={it.key} className="breakdown-row">
          <span className="breakdown-label">{it.label}</span>
          <div className="breakdown-track">
            <div
              className="breakdown-fill"
              style={{ width: `${(it.count / max) * 100}%`, background: palette[idx % palette.length] }}
            />
          </div>
          <span className="breakdown-count">{it.count}</span>
        </div>
      ))}
    </div>
  );
}

function TopList({ title, items, onOpen }) {
  return (
    <div className="top-list">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="top-empty">暂无数据</p>
      ) : (
        <ol>
          {items.map((it) => (
            <li key={it.id} onClick={() => onOpen?.(it)}>
              <span className="top-title">{it.title}</span>
              <span className="top-meta">{it.subbar ? `${it.subbar} · ` : ''}{it.views} 浏览</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

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

  const kpis = stats && [
    { label: '总用户数', value: stats.totals.users, accent: '#007bff' },
    { label: '今日活跃', value: stats.active_users_today, accent: '#20c997' },
    { label: '本周新增用户', value: stats.new_users_week, accent: '#6f42c1' },
    { label: '问题', value: stats.totals.questions, accent: '#fd7e14' },
    { label: '文章', value: stats.totals.articles, accent: '#e83e8c' },
    { label: '子吧', value: stats.totals.subbars, accent: '#17a2b8' },
    { label: '帖子', value: stats.totals.posts, accent: '#007bff' },
    { label: '本周新帖', value: stats.new_posts_week, accent: '#20c997' },
  ];

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h1>管理面板</h1>
          <p>系统统计和管理工具</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : stats ? (
        <div className="admin-content">
          <div className="stats-grid">
            {kpis.map((k) => (
              <div key={k.label} className="stat-card">
                <div className="stat-number" style={{ color: k.accent }}>{k.value}</div>
                <div className="stat-label">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="panel-grid">
            <div className="panel">
              <div className="panel-head">新增用户 <span>近 {stats.days} 天</span></div>
              <TrendChart data={stats.series.users} color="#007bff" />
            </div>
            <div className="panel">
              <div className="panel-head">新增内容 <span>近 {stats.days} 天</span></div>
              <TrendChart data={stats.series.content} color="#20c997" />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">内容类型分布</div>
            <BreakdownBars items={stats.content_breakdown} />
          </div>

          <div className="panel-grid panel-grid-3">
            <TopList title="🔥 热门问题" items={stats.top_questions}
              onOpen={(it) => navigate(`/qa/questions/${it.id}`)} />
            <TopList title="🔥 热门文章" items={stats.top_articles}
              onOpen={(it) => navigate(`/knowledge/${it.id}`)} />
            <TopList title="🔥 热门帖子" items={stats.top_posts}
              onOpen={(it) => navigate(`/postbar/posts/${it.id}`)} />
          </div>

          <div className="admin-menu">
            <button className="admin-btn" onClick={() => navigate('/admin/users')}>
              👥 用户管理
            </button>
            <button className="admin-btn" onClick={() => navigate('/admin/content')}>
              📝 内容管理
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
