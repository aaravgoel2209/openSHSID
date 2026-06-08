import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import '../styles/Admin.css';

export default function AdminContent() {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!user?.is_staff) {
      navigate('/');
      return;
    }

    const fetchContent = async () => {
      try {
        const url = activeTab === 'all'
          ? 'http://localhost:8000/api/auth/admin/content/'
          : `http://localhost:8000/api/auth/admin/content/?type=${activeTab}`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Token ${token}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch content');
        const data = await response.json();
        setContent(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    fetchContent();
  }, [user, token, navigate, activeTab]);

  if (!user?.is_staff) return null;

  return (
    <div className="admin-container">
      <div className="admin-header">
        <button onClick={() => navigate('/admin')} className="back-btn">← 返回</button>
        <h1>内容管理</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="content-tabs">
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          全部
        </button>
        <button
          className={`tab ${activeTab === 'questions' ? 'active' : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          问题
        </button>
        <button
          className={`tab ${activeTab === 'answers' ? 'active' : ''}`}
          onClick={() => setActiveTab('answers')}
        >
          回答
        </button>
        <button
          className={`tab ${activeTab === 'articles' ? 'active' : ''}`}
          onClick={() => setActiveTab('articles')}
        >
          文章
        </button>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : content ? (
        <div className="content-list">
          {content.questions && content.questions.length > 0 && (
            <div className="content-section">
              <h2>问题 ({content.questions.length})</h2>
              <div className="content-items">
                {content.questions.map(q => (
                  <div key={q.id} className="content-item">
                    <h3>{q.title}</h3>
                    <p>作者: {q.author}</p>
                    <p>浏览: {q.views}</p>
                    <p>时间: {new Date(q.created_at).toLocaleDateString('zh-CN')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {content.answers && content.answers.length > 0 && (
            <div className="content-section">
              <h2>回答 ({content.answers.length})</h2>
              <div className="content-items">
                {content.answers.map(a => (
                  <div key={a.id} className="content-item">
                    <h3>问题: {a.question}</h3>
                    <p>作者: {a.author}</p>
                    <p>时间: {new Date(a.created_at).toLocaleDateString('zh-CN')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {content.articles && content.articles.length > 0 && (
            <div className="content-section">
              <h2>文章 ({content.articles.length})</h2>
              <div className="content-items">
                {content.articles.map(a => (
                  <div key={a.id} className="content-item">
                    <h3>{a.title}</h3>
                    <p>作者: {a.author}</p>
                    <p>时间: {new Date(a.created_at).toLocaleDateString('zh-CN')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!content.questions?.length && !content.answers?.length && !content.articles?.length && (
            <div className="empty-state">暂无内容</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
