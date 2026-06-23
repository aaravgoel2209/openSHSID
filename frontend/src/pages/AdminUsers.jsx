import { motion } from 'framer-motion';
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { Button } from '@heroui/react/button';
import { AuthContext } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

export default function AdminUsers() {
  const { user, token } = useContext(AuthContext);
  const { hasGlass } = useUI();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    if (!user?.is_staff) { navigate('/'); return; }
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/auth/admin/users/', {
          headers: { 'Authorization': `Token ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        setUsers(await response.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [user, token, navigate]);

  const handleEdit = (u) => {
    setEditingId(u.id);
    setEditData({ is_staff: u.is_staff, is_active: u.is_active, username: u.username, email: u.email });
  };

  const handleSave = async (userId) => {
    try {
      const response = await fetch(`/api/auth/admin/users/${userId}/`, {
        method: 'PATCH',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (!response.ok) throw new Error('Failed to update user');
      const updated = await response.json();
      setUsers(users.map(u => u.id === userId ? updated : u));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('确定要删除该用户吗？')) return;
    try {
      const response = await fetch(`/api/auth/admin/users/${userId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete user');
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user?.is_staff) return null;

  const glassBg = hasGlass ? 'bg-white/70 dark:bg-black/60 backdrop-blur-md' : 'bg-white dark:bg-gray-900';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl mx-auto px-4 py-6"
    >
      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-gray-200 dark:border-slate-800">
        <Button variant="light" size="sm" onPress={() => navigate('/admin')}>← 返回</Button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">用户管理</h1>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className={`rounded-2xl overflow-hidden border border-gray-200/80 dark:border-slate-800/80 ${glassBg}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">用户名</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">邮箱</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">注册时间</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">管理员</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">活跃</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.03 }}
                    className={`border-b border-gray-100 dark:border-slate-800/50 transition-colors ${
                      editingId === u.id ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-gray-50/50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.id}</td>
                    <td className="px-4 py-3">
                      {editingId === u.id ? (
                        <input
                          value={editData.username}
                          onChange={(e) => setEditData({...editData, username: e.target.value})}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      ) : (
                        <span className="font-medium text-gray-900 dark:text-gray-100">{u.username}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === u.id ? (
                        <input
                          value={editData.email}
                          onChange={(e) => setEditData({...editData, email: e.target.value})}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      ) : (
                        <span className="text-gray-600 dark:text-gray-400">{u.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(u.date_joined).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingId === u.id ? (
                        <input
                          type="checkbox"
                          checked={editData.is_staff}
                          onChange={(e) => setEditData({...editData, is_staff: e.target.checked})}
                          className="accent-indigo-500 w-4 h-4 cursor-pointer"
                        />
                      ) : (
                        <span className={u.is_staff ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}>
                          {u.is_staff ? '✓' : '✗'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingId === u.id ? (
                        <input
                          type="checkbox"
                          checked={editData.is_active}
                          onChange={(e) => setEditData({...editData, is_active: e.target.checked})}
                          className="accent-indigo-500 w-4 h-4 cursor-pointer"
                        />
                      ) : (
                        <span className={u.is_active ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}>
                          {u.is_active ? '✓' : '✗'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === u.id ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" color="primary" variant="flat" onPress={() => handleSave(u.id)}>保存</Button>
                          <Button size="sm" variant="light" onPress={() => setEditingId(null)}>取消</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="flat" onPress={() => handleEdit(u)}>编辑</Button>
                          <Button size="sm" color="danger" variant="flat" onPress={() => handleDelete(u.id)}>删除</Button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
