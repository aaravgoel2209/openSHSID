import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { TextField } from '@heroui/react/textfield';
import { Label } from '@heroui/react/label';
import { Description } from '@heroui/react/description';
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

  const ErrorMsg = ({ msg }) => msg ? (
    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
      <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
      </svg>
      {msg}
    </div>
  ) : null;

  return (
    <div className="flex justify-center items-center min-h-[70vh] animate-fade-in">
      <div className="w-full max-w-sm">
        {/* Decorative header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">创建账号</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">加入 SHSID 校园社区</p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <TextField>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">用户名</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={150} placeholder="选择一个用户名" className="mt-1" />
              <Description className="text-xs text-gray-400 mt-1">不超过150个字符，仅包含字母、数字和 @/./+/-/_</Description>
            </TextField>
            <ErrorMsg msg={errors.username} />

            <TextField>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">密码</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="设置密码" className="mt-1" />
              <Description className="text-xs text-gray-400 mt-1">至少8个字符，不能全是数字</Description>
            </TextField>
            <ErrorMsg msg={errors.password} />

            <TextField>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">确认密码</Label>
              <Input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="再次输入密码" className="mt-1" />
            </TextField>
            <ErrorMsg msg={errors.password2} />
            <ErrorMsg msg={errors.general} />

            <Button type="submit" color="primary" fullWidth isLoading={submitting} className="font-medium h-11">
              {submitting ? '注册中...' : '注册'}
            </Button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-sm text-center mt-5 text-gray-500 dark:text-gray-400">
          已有账号？
          <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline ml-1">登录</Link>
        </p>
      </div>
    </div>
  );
}
