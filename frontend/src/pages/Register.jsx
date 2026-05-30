import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { AuthContext } from '../context/AuthContext';

export default function Register() {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (password !== password2) {
      setErrors({ password2: '两次密码不一致。' });
      return;
    }
    setSubmitting(true);
    try {
      await register(username, password);
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const parsed = {};
        Object.entries(data).forEach(([key, msgs]) => {
          parsed[key] = Array.isArray(msgs) ? msgs.join(' ') : msgs;
        });
        setErrors(parsed);
      } else {
        setErrors({ general: '注册失败，请重试。' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-center mb-6">注册</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            isRequired
            maxLength={150}
            labelPlacement="outside"
            description="不超过150个字符。仅包含字母、数字和 @/./+/-/_ 。"
          />
          {errors.username && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{errors.username}</div>
          )}
          <Input
            label="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            isRequired
            labelPlacement="outside"
            description="至少8个字符，不能全是数字。"
          />
          {errors.password && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{errors.password}</div>
          )}
          <Input
            label="确认密码"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            isRequired
            labelPlacement="outside"
          />
          {errors.password2 && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{errors.password2}</div>
          )}
          {errors.general && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{errors.general}</div>
          )}
          <Button type="submit" color="primary" fullWidth isLoading={submitting}>
            {submitting ? '注册中...' : '注册'}
          </Button>
        </form>
        <p className="text-sm text-center mt-4 text-gray-500 dark:text-gray-400">
          已有账号？<Link to="/login" className="text-primary-600 underline">登录</Link>
        </p>
      </div>
    </div>
  );
}
