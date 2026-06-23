import { useContext, useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@heroui/react/avatar';
import { Dropdown, DropdownTrigger, DropdownPopover, DropdownMenu, DropdownItem } from '@heroui/react/dropdown';
import { SunIcon, MoonIcon, PlusIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useUI } from '../context/UIContext';
import NotificationBell from './NotificationBell';
import GlassPanel from './GlassPanel';

// Pick one background image per page load (module-level = runs once, stable across re-renders).
// Drop images into frontend/src/assets/background/ and they're picked up automatically.
const _bgGlob = import.meta.glob('../assets/background/*.{jpg,jpeg,png,webp,avif,gif}', { eager: true });
const _bgUrls = Object.values(_bgGlob).map(m => m.default);
const RANDOM_BG = _bgUrls.length > 0 ? _bgUrls[Math.floor(Math.random() * _bgUrls.length)] : null;

const NAV_LINKS = [
  { to: '/', label: '首页', icon: '🏠' },
  { to: '/qa', label: '问答', icon: '💬' },
  { to: '/knowledge', label: '知识库', icon: '📚' },
  { to: '/chat', label: '聊天', icon: '💭' },
  { to: '/mailbox', label: '信箱', icon: '📬' },
];

const AVATAR_COLORS = ['blue','green','red','purple','orange','indigo','emerald','sky','rose'];

function getAvatarColor(username) {
  const hash = Math.abs(username.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
  return AVATAR_COLORS[hash % 9];
}

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const { isDark, toggle } = useContext(ThemeContext);
  const { complexity } = useUI();
  // 普通及以上：顶栏加毛玻璃模糊（兼容模式保持纯色）
  const topbarBlur = complexity !== 'simple';
  const bgBlur = complexity === 'extreme' ? 28 : complexity === 'complex' ? 22 : 18;
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [now, setNow] = useState(new Date());
  const [hotItems, setHotItems] = useState([]);
  const [weeklyTop, setWeeklyTop] = useState([]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    fetch('/api/auth/weekly-top/').then(r => r.json()).then(setWeeklyTop).catch(() => {});
  }, []);
  useEffect(() => {
    Promise.all([
      fetch('/api/qa/questions/').then(r => r.json()).catch(() => []),
      fetch('/api/knowledge/articles/').then(r => r.json()).catch(() => []),
    ]).then(([qs, as]) => {
      const daysAgo = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0;
      const scored = [
        ...qs.map(q => ({ ...q, _heat: 2 + (q.views || 0) * 0.1 + (q.like_count || 0) * 0.3 + (q.answer_count || 0) * 0.2 - daysAgo(q.created_at) * 0.1, _type: '问答' })),
        ...as.map(a => ({ ...a, _heat: 2 + (a.views || 0) * 0.1 + (a.like_count || 0) * 0.3 - daysAgo(a.created_at) * 0.1, _type: '文章' })),
      ].sort((a, b) => b._heat - a._heat).slice(0, 5);
      setHotItems(scored);
    });
  }, []);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen">
      {/* Single fixed blur layer — replaces per-card backdrop-filter (1 GPU layer vs 20+) */}
      {complexity !== 'simple' && RANDOM_BG && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: '-60px', right: '-60px', bottom: '-60px', left: '-60px',
            zIndex: -1,
            backgroundImage: `url(${RANDOM_BG})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: `blur(${bgBlur}px)`,
          }}
        />
      )}
      {/* Top Bar */}
      <header className={`sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 ${
        topbarBlur ? 'bg-white/70 dark:bg-black/60 backdrop-blur-md' : 'bg-white dark:bg-black'
      }`}>
        <div className="flex items-center h-12 px-3 gap-2 max-w-[1600px] mx-auto">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500">
            {sidebarOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
          </button>
          <Link to="/" className="font-bold text-sm text-gray-900 dark:text-white no-underline shrink-0">shsid</Link>
          <div className="flex-1 max-w-md mx-auto">
            <input
              type="text"
              placeholder="搜索..."
              className="w-full h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 text-xs dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-800 transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
                  e.target.value = '';
                }
              }}
            />
          </div>
          <button onClick={toggle} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500" title={isDark ? '浅色' : '深色'}>
            {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
          <NotificationBell />
          {user ? (
            <Dropdown>
              <DropdownTrigger>
                <Avatar as="button" className="cursor-pointer w-7 h-7" size="sm" color="primary">
                  <AvatarImage src={`/images/${getAvatarColor(user.username)}.jpg`} />
                  <AvatarFallback className="text-[10px]">{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </DropdownTrigger>
              <DropdownPopover>
                <DropdownMenu>
                  <DropdownItem key="info" textValue="用户名">
                    <p className="font-semibold text-sm">{user.username}</p>
                    <p className="text-xs text-default-500">已登录</p>
                  </DropdownItem>
                  <DropdownItem key="profile" onPress={() => navigate('/profile')}>个人中心</DropdownItem>
                  <DropdownItem key="settings" onPress={() => navigate('/settings')}>设置</DropdownItem>
                  {user.is_staff && <DropdownItem key="admin" onPress={() => window.open('/admin/', '_blank')}>管理面板</DropdownItem>}
                  <DropdownItem key="logout" className="text-red-500" onPress={() => { logout(); navigate('/'); }}>登出</DropdownItem>
                </DropdownMenu>
              </DropdownPopover>
            </Dropdown>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => navigate('/login')} className="text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400">登录</button>
              <button onClick={() => navigate('/register')} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">注册</button>
            </div>
          )}
        </div>
      </header>

      <div className="flex max-w-[1600px] mx-auto">
        {/* Left Sidebar */}
        {sidebarOpen && (
          <aside className={`w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 min-h-[calc(100vh-48px)] p-2 ${
            topbarBlur ? 'bg-white/60 dark:bg-black/60 backdrop-blur-md' : 'bg-gray-50 dark:bg-gray-950'
          }`}>
            {/* Create Post */}
            <button onClick={() => navigate('/qa/ask')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium mb-3 transition-colors">
              <PlusIcon className="w-4 h-4" />
              发布
            </button>

            {/* Navigation */}
            <nav className="space-y-0.5">
              {NAV_LINKS.map(({ to, label, icon }) => (
                <Link key={to} to={to}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${
                    isActive(to)
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  <span className="text-base">{icon}</span>
                  {label}
                </Link>
              ))}
            </nav>

            {/* User info */}
            {user?.is_staff && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                <Link to="/admin/memory"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 no-underline transition-colors"
                >
                  🧠 模型记忆
                </Link>
              </div>
            )}
            {user && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Avatar size="sm" className="w-6 h-6">
                    <AvatarImage src={`/images/${getAvatarColor(user.username)}.jpg`} />
                    <AvatarFallback className="text-[9px]">{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{user.username}</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 px-3">
              <p className="text-[10px] text-gray-400 dark:text-gray-600">In develop, not final version, preparing for ICP</p>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-48px)]">
          <div className="max-w-3xl mx-auto px-4 py-4 dark:text-gray-200">
            <Outlet />
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className={`w-60 shrink-0 border-l border-gray-200 dark:border-gray-800 min-h-[calc(100vh-48px)] hidden lg:block p-3 ${
          topbarBlur ? ' backdrop-blur-md' : ''
        }`}>
          <GlassPanel
            plainClass="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-center"
            glassContentClass="p-3 text-center"
            cornerRadius={12}
          >
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}:{now.getSeconds().toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日 周{['日','一','二','三','四','五','六'][now.getDay()]}
            </div>
          </GlassPanel>

          {/* Weekly Top Users */}
          <GlassPanel
            className="mt-3"
            plainClass="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
            glassContentClass="p-3"
            cornerRadius={12}
          >
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">本周活跃</h3>
            {weeklyTop.length === 0 ? (
              <p className="text-xs text-gray-400">加载中...</p>
            ) : (
              <div className="space-y-2">
                {weeklyTop.map((u, i) => (
                  <div key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                    onClick={() => navigate(`/profile/${u.id}`)}>
                    <span className="text-xs font-bold text-gray-400 w-4 shrink-0 text-center">{i + 1}</span>
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300 shrink-0">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-700 dark:text-gray-300 truncate font-medium">{u.username}</p>
                      <p className="text-[10px] text-gray-400">热度 {u.total_heat}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>

          {/* Hot Items */}
          <GlassPanel
            className="mt-3"
            plainClass="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
            glassContentClass="p-3"
            cornerRadius={12}
          >
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">热门</h3>
            {hotItems.length === 0 ? (
              <p className="text-xs text-gray-400">加载中...</p>
            ) : (
              <div className="space-y-2">
                {hotItems.map((item, i) => (
                  <div key={`${item._type}-${item.id}`} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                    onClick={() => navigate(item._type === '问答' ? `/qa/questions/${item.id}` : `/knowledge/${item.id}`)}>
                    <span className="text-xs font-bold text-gray-400 w-4 shrink-0 mt-0.5">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{item.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{item._type} · {item.views} 次浏览</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}
