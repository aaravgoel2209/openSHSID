import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/authContext';
import client from '../api/client';
import '../styles/Admin.css';

export default function AdminUsers() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    if (!user?.is_staff) {
      navigate('/');
      return;
    }

    client.get('/auth/admin/users/')
      .then((r) => setUsers(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const handleEdit = (u) => {
    setEditingId(u.id);
    setEditData({
      is_staff: u.is_staff,
      is_active: u.is_active,
      username: u.username,
      email: u.email,
    });
  };

  const handleSave = async (userId) => {
    try {
      const updated = await client.patch(`/auth/admin/users/${userId}/`, editData).then((r) => r.data);
      setUsers(users.map(u => u.id === userId ? updated : u));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('确定要删除该用户吗？')) return;
    try {
      await client.delete(`/auth/admin/users/${userId}/`);
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user?.is_staff) return null;

  return (
    <div className="admin-container">
      <div className="admin-header">
        <button onClick={() => navigate('/admin')} className="back-btn">← 返回</button>
        <h1>用户管理</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>邮箱</th>
                <th>注册时间</th>
                <th>管理员</th>
                <th>活跃</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={editingId === u.id ? 'editing' : ''}>
                  <td>{u.id}</td>
                  <td>
                    {editingId === u.id ? (
                      <input
                        value={editData.username}
                        onChange={(e) => setEditData({...editData, username: e.target.value})}
                      />
                    ) : (
                      u.username
                    )}
                  </td>
                  <td>
                    {editingId === u.id ? (
                      <input
                        value={editData.email}
                        onChange={(e) => setEditData({...editData, email: e.target.value})}
                      />
                    ) : (
                      u.email
                    )}
                  </td>
                  <td>{new Date(u.date_joined).toLocaleDateString('zh-CN')}</td>
                  <td>
                    {editingId === u.id ? (
                      <input
                        type="checkbox"
                        checked={editData.is_staff}
                        onChange={(e) => setEditData({...editData, is_staff: e.target.checked})}
                      />
                    ) : (
                      u.is_staff ? '✓' : '✗'
                    )}
                  </td>
                  <td>
                    {editingId === u.id ? (
                      <input
                        type="checkbox"
                        checked={editData.is_active}
                        onChange={(e) => setEditData({...editData, is_active: e.target.checked})}
                      />
                    ) : (
                      u.is_active ? '✓' : '✗'
                    )}
                  </td>
                  <td>
                    {editingId === u.id ? (
                      <>
                        <button
                          className="btn-save"
                          onClick={() => handleSave(u.id)}
                        >
                          保存
                        </button>
                        <button
                          className="btn-cancel"
                          onClick={() => setEditingId(null)}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-edit"
                          onClick={() => handleEdit(u)}
                        >
                          编辑
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDelete(u.id)}
                        >
                          删除
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
