import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { TextField } from '@heroui/react/textfield';
import { Label } from '@heroui/react/label';
import { Input } from '@heroui/react/input';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.non_field_errors?.[0] || '登录失败，请检查用户名和密码。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-sm bg-white dark:bg-slate-950 border border-gray-200 dark:border-gray-900 rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-center mb-6">登录</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField>
            <Label>用户名</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </TextField>
          <TextField>
            <Label>密码</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </TextField>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{error}</div>
          )}
          <Button type="submit" color="primary" fullWidth isLoading={submitting}>
            {submitting ? '登录中...' : '登录'}
          </Button>
        </form>
        <p className="text-sm text-center mt-4 text-gray-500 dark:text-gray-400">
          还没有账号？<Link to="/register" className="text-primary-600 underline">注册</Link>
        </p>
      </div>
    </div>
  );
}
