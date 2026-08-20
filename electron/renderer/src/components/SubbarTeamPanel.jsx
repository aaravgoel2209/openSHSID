import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubbarTeam, addManager, removeManager } from '../api/postbar';
import { AuthContext } from '../context/authContext';
import { useLang } from '../context/useLang';
import GlassPanel from './GlassPanel';

// 右栏「吧务团队」面板：显示吧主 + 吧务；吧主可任免吧务。
// 挂在 Layout 右侧栏，仅在浏览某个子吧（/postbar/b/:id）时出现。
export default function SubbarTeamPanel({ subbarId }) {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { t } = useLang();
  const [sub, setSub] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => { getSubbarTeam(subbarId).then(setSub).catch(() => setSub(null)); };
  useEffect(() => { setSub(null); setError(''); load(); }, [subbarId]);

  if (!sub) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setBusy(true);
    try {
      const updated = await addManager(subbarId, name.trim());
      setSub(updated);
      setName('');
    } catch (err) {
      setError(err?.response?.data?.error || t('postbar.addManagerFail'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (uid) => {
    setBusy(true);
    try {
      setSub(await removeManager(subbarId, uid));
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const Member = ({ id, username, role, removable }) => (
    <div className="flex items-center gap-2 py-1">
      <button
        onClick={() => navigate(`/profile/${id}`)}
        className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300 shrink-0"
      >
        {username?.charAt(0).toUpperCase()}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-700 dark:text-gray-300 truncate font-medium">{username}</p>
        <p className="text-[10px] text-gray-400">{role}</p>
      </div>
      {removable && (
        <button
          onClick={() => handleRemove(id)}
          disabled={busy}
          title={t('postbar.removeManager')}
          className="text-gray-300 hover:text-rose-500 transition-colors text-sm shrink-0"
        >
          <i className="bi bi-x-lg" />
        </button>
      )}
    </div>
  );

  return (
    <GlassPanel
      className="mt-3"
      plainClass="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
      glassContentClass="p-3"
      cornerRadius={12}
    >
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
        {t('postbar.team')}
      </h3>

      <div className="space-y-0.5">
        {sub.creator_name && (
          <Member id={sub.created_by} username={sub.creator_name} role={t('postbar.owner')} removable={false} />
        )}
        {sub.managers?.map((m) => (
          <Member key={m.id} id={m.id} username={m.username} role={t('postbar.manager')} removable={sub.is_owner} />
        ))}
        {(!sub.managers || sub.managers.length === 0) && (
          <p className="text-[11px] text-gray-400 py-1">{t('postbar.noManagers')}</p>
        )}
      </div>

      {sub.is_owner && (
        <form onSubmit={handleAdd} className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('postbar.addManagerPlaceholder')}
              className="flex-1 min-w-0 text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-blue-400 outline-none text-gray-700 dark:text-gray-200"
            />
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium shrink-0"
            >
              {t('postbar.addManager')}
            </button>
          </div>
          {error && <p className="text-[11px] text-rose-500 mt-1">{error}</p>}
        </form>
      )}
    </GlassPanel>
  );
}
