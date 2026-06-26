import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { AuthContext } from '../context/AuthContext';
import { getCourses, getCredentials, saveCredentials, deleteCredentials, syncCourses, clearSessionCache, getBrowserLoginHtml } from '../api/crawler';

const LC_TEAL = '#00a9ce';
const LC_ORANGE = '#ED8B00';

const COURSE_GRADIENTS = [
  ['#4f46e5','#7c3aed'],['#0891b2','#0e7490'],['#059669','#047857'],
  ['#d97706','#b45309'],['#dc2626','#b91c1c'],['#7c3aed','#6d28d9'],
  ['#0284c7','#0369a1'],['#16a34a','#15803d'],['#db2777','#be185d'],
];

function courseGradient(id) {
  const idx = Number(id || 0) % COURSE_GRADIENTS.length;
  const [a, b] = COURSE_GRADIENTS[idx];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function CourseTile({ course }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        borderTop: `4px solid ${hovered ? LC_ORANGE : LC_TEAL}`,
        transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
        cursor: 'pointer',
        borderRadius: 14,
        width: 220,
        height: 160,
        flexShrink: 0,
        boxShadow: hovered
          ? '0 8px 28px rgba(0,169,206,0.18), 0 2px 8px rgba(0,0,0,0.08)'
          : '0 2px 10px rgba(0,0,0,0.07)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        overflow: 'hidden',
        position: 'relative',
      }}
      className="border border-gray-200/60 dark:border-gray-700/60 bg-white/55 dark:bg-gray-800/70 backdrop-blur-md"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/linkedclassroom/${course.course_id}`)}
    >
      {/* Gradient banner */}
      <div style={{ background: courseGradient(course.course_id), height: 72, borderRadius: '10px 10px 0 0' }} />
      <div className="px-3 py-2">
        <p style={{ fontSize: 14, fontWeight: 700, color: hovered ? LC_TEAL : undefined, margin: 0, lineHeight: 1.3, transition: 'color 0.15s' }}
           className="text-gray-800 dark:text-gray-100 line-clamp-2">
          {course.title}
        </p>
        <p className="text-[11px] text-gray-400 mt-1 m-0">
          {course.section_count} 个章节
        </p>
      </div>
      {/* Course ID badge */}
      <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.35)', borderRadius: 4, padding: '1px 6px' }}>
        <span style={{ color: '#fff', fontSize: 10 }}>#{course.course_id}</span>
      </div>
    </div>
  );
}

function CredentialPanel({ onSaved }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSave = async () => {
    if (!username || !password) return;
    setSaving(true);
    try {
      await saveCredentials(username, password);
      setMsg('已保存');
      setUsername('');
      setPassword('');
      onSaved?.();
    } catch {
      setMsg('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <i className="bi bi-key-fill" style={{ color: LC_TEAL }} />
        LinkedClassroom 账号
      </h3>
      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 min-w-32 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
          placeholder="用户名"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <input
          type="password"
          className="flex-1 min-w-32 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
          placeholder="密码"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        <button
          onClick={handleSave}
          disabled={saving || !username || !password}
          className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
          style={{ background: LC_TEAL }}
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
      {msg && <p className="text-xs text-gray-400 mt-2">{msg}</p>}
    </div>
  );
}

export default function LinkedClassroom() {
  const { user } = useContext(AuthContext);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cred, setCred] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [showCredForm, setShowCredForm] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      getCourses().catch(() => []),
      user ? getCredentials().catch(() => null) : Promise.resolve(null),
    ]).then(([c, cr]) => {
      setCourses(c);
      setCred(cr);
    }).finally(() => setLoading(false));
  };

  useEffect(fetchAll, [user]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await syncCourses();
      setSyncMsg(res.message || '同步完成');
      fetchAll();
    } catch (e) {
      setSyncMsg(e?.response?.data?.error || '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteCred = async () => {
    await deleteCredentials().catch(() => {});
    setCred(null);
    setSyncMsg('');
  };

  const handleBrowserLogin = async () => {
    try {
      const html = await getBrowserLoginHtml();
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const popup = window.open(blobUrl, 'lc_browser_login', 'width=720,height=540,noopener');
      // Revoke after the popup has had time to parse and submit the form
      setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
      if (!popup) setSyncMsg('请允许弹出窗口以完成 LC 登录');
    } catch {
      setSyncMsg('获取登录页面失败');
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const res = await clearSessionCache();
      setSyncMsg(res.message || '缓存已清除');
    } catch {
      setSyncMsg('清除失败');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* LC-style header bar */}
      <div style={{ background: `linear-gradient(90deg, ${LC_TEAL}, #0077a8)`, borderRadius: 12, marginBottom: 24, padding: '20px 24px' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>LinkedClassroom</h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, margin: '4px 0 0' }}>
              {courses.length} 门课程
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Credentials status */}
            {user && (
              cred?.configured ? (
                <div className="flex items-center gap-2">
                  <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, padding: '3px 10px', borderRadius: 20 }}>
                    <i className="bi bi-person-check-fill mr-1" />{cred.username}
                  </span>
                  <button onClick={() => setShowCredForm(v => !v)}
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                    更换
                  </button>
                  <button onClick={handleDeleteCred}
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                    <i className="bi bi-trash3" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowCredForm(v => !v)}
                  style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  <i className="bi bi-key-fill mr-1" />绑定账号
                </button>
              )
            )}
            {/* Browser session sync — any credentialed user */}
            {user && cred?.configured && (
              <button
                onClick={handleBrowserLogin}
                title="在浏览器中登录 LC，使图片和资源可直接加载"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
              >
                <i className="bi bi-box-arrow-in-right mr-1" />同步LC会话
              </button>
            )}
            {/* Sync + cache buttons — admin only */}
            {user?.is_staff && (
              <>
                <button
                  onClick={handleClearCache}
                  disabled={clearing}
                  title="清除服务器端 LC 会话缓存，下次图片请求将重新登录"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: clearing ? 'wait' : 'pointer' }}
                >
                  {clearing ? <i className="bi bi-hourglass-split" /> : <i className="bi bi-trash3" />}
                  <span className="ml-1">清除缓存</span>
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  style={{ background: syncing ? LC_ORANGE + '99' : LC_ORANGE, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 13, cursor: syncing ? 'wait' : 'pointer', fontWeight: 600 }}
                >
                  {syncing ? <><i className="bi bi-arrow-repeat animate-spin mr-1" />同步中…</> : <><i className="bi bi-arrow-clockwise mr-1" />同步课程</>}
                </button>
              </>
            )}
          </div>
        </div>
        {syncMsg && (
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, margin: '10px 0 0' }}>{syncMsg}</p>
        )}
      </div>

      {/* Credential form */}
      {showCredForm && user && (
        <CredentialPanel onSaved={() => { setShowCredForm(false); fetchAll(); }} />
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
               style={{ background: `rgba(0,169,206,0.1)` }}>
            <i className="bi bi-grid-3x3-gap" style={{ fontSize: 28, color: LC_TEAL }} />
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-1">还没有同步的课程</p>
          {user?.is_staff
            ? <p className="text-sm text-gray-400">绑定账号后点击「同步课程」</p>
            : <p className="text-sm text-gray-400">请等待管理员同步课程</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {courses.map(c => <CourseTile key={c.id} course={c} />)}
          {[...Array(6)].map((_, i) => <div key={i} style={{ width: 220, height: 0 }} aria-hidden />)}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-8">
        数据来自 LinkedClassroom · 仅供参考，请以官网为准
      </p>
    </div>
  );
}
