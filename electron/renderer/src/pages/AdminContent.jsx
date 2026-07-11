import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import client from '../api/client';
import '../styles/Admin.css';

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'questions', label: '问题' },
  { key: 'answers', label: '回答' },
  { key: 'articles', label: '文章' },
  { key: 'posts', label: '帖子' },
];

export default function AdminContent() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const fetchContent = () => {
    setLoading(true);
    const url = activeTab === 'all'
      ? '/auth/admin/content/'
      : `/auth/admin/content/?type=${activeTab}`;
    client.get(url)
      .then((r) => setContent(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user?.is_staff) {
      navigate('/');
      return;
    }
    fetchContent();
  }, [user, navigate, activeTab]);

  const handleDelete = async (kind, id, label) => {
    if (!window.confirm(`确定删除该${label}吗？此操作不可撤销。`)) return;
    try {
      await client.delete(`/auth/admin/content/${kind}/${id}/`);
      // 本地移除，避免整表刷新
      setContent((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (Array.isArray(next[key])) next[key] = next[key].filter((x) => x.id !== id || key !== kind);
        }
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  if (!user?.is_staff) return null;

  const section = (kind, label, items, renderMeta) => items?.length > 0 && (
    <div className="content-section">
      <h2>{label} ({items.length})</h2>
      <div className="content-items">
        {items.map((it) => (
          <div key={it.id} className="content-item">
            <button
              className="content-del"
              title="删除"
              onClick={() => handleDelete(kind, it.id, label)}
            >
              ✕
            </button>
            <h3>{it.title || it.question}</h3>
            {renderMeta(it)}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="admin-container">
      <div className="admin-header">
        <button onClick={() => navigate('/admin')} className="back-btn">← 返回</button>
        <h1>内容管理</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="content-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : content ? (
        <div className="content-list">
          {section('questions', '问题', content.questions, (q) => (
            <>
              <p>作者: {q.author}</p>
              <p>浏览: {q.views}</p>
              <p>时间: {new Date(q.created_at).toLocaleDateString('zh-CN')}</p>
            </>
          ))}

          {section('answers', '回答', content.answers, (a) => (
            <>
              <p>作者: {a.author}</p>
              <p>时间: {new Date(a.created_at).toLocaleDateString('zh-CN')}</p>
            </>
          ))}

          {section('articles', '文章', content.articles, (a) => (
            <>
              <p>作者: {a.author}</p>
              <p>时间: {new Date(a.created_at).toLocaleDateString('zh-CN')}</p>
            </>
          ))}

          {section('posts', '帖子', content.posts, (p) => (
            <>
              <p>吧: {p.subbar}</p>
              <p>作者: {p.author}</p>
              <p>浏览: {p.views}</p>
              <p>时间: {new Date(p.created_at).toLocaleDateString('zh-CN')}</p>
            </>
          ))}

          {!content.questions?.length && !content.answers?.length &&
            !content.articles?.length && !content.posts?.length && (
            <div className="empty-state">暂无内容</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
