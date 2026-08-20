import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { TextField } from '@heroui/react/textfield';
import { Label } from '@heroui/react/label';
import { Input } from '@heroui/react/input';
import { TextArea } from '@heroui/react/textarea';
import { PlusIcon, UserGroupIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { getSubbars, createSubbar } from '../api/postbar';
import { AuthContext } from '../context/authContext';

export default function PostbarHome() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [subbars, setSubbars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getSubbars().then(setSubbars).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const sub = await createSubbar(name.trim(), description.trim());
      setName('');
      setDescription('');
      setCreating(false);
      navigate(`/postbar/b/${sub.id}`);
    } catch (err) {
      if (err?.response?.status === 401) setError('请先登录后再创建吧');
      else setError(err?.response?.data?.error || err?.response?.data?.name?.[0] || '创建失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">贴吧</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subbars.length} 个吧</p>
        </div>
        <Button color="primary" variant="shadow" onPress={() => setCreating((v) => !v)} className="font-medium">
          <PlusIcon className="w-4 h-4" />
          创建吧
        </Button>
      </div>

      {/* Create Subbar form */}
      {creating && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 mb-6 shadow-sm flex flex-col gap-4 animate-slide-up">
          {!user && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">请先登录后再创建吧。</p>
          )}
          <TextField>
            <Label>吧名</Label>
            <Input placeholder="例如：物理竞赛" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
          </TextField>
          <TextField>
            <Label>简介</Label>
            <TextArea placeholder="这个吧是关于什么的？" value={description} onChange={(e) => setDescription(e.target.value)} minRows={2} maxLength={200} />
          </TextField>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" color="primary" isLoading={submitting} isDisabled={submitting || !user || !name.trim()}>
              {submitting ? '创建中...' : '创建'}
            </Button>
            <Button variant="light" onPress={() => setCreating(false)}>取消</Button>
          </div>
        </form>
      )}

      {subbars.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
            <UserGroupIcon className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-3">还没有吧</p>
          <Button color="primary" variant="flat" size="sm" onPress={() => setCreating(true)}>
            来创建第一个吧
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subbars.map((s, index) => (
            <div
              key={s.id}
              className="group bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-xl p-5 cursor-pointer hover-lift hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-all duration-200"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => navigate(`/postbar/b/${s.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-500 font-bold text-lg">
                  {s.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                    {s.name}
                  </h2>
                  {s.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{s.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                    <span className="flex items-center gap-1">
                      <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                      {s.post_count} 帖
                    </span>
                    {s.creator_name && <span>吧主 {s.creator_name}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
