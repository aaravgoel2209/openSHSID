import { useContext, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@heroui/react/avatar';
import { Dropdown, DropdownTrigger, DropdownPopover, DropdownMenu, DropdownItem } from '@heroui/react/dropdown';
import { SunIcon, MoonIcon, PlusIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';

const NAV_LINKS = [
  { to: '/', label: '首页', icon: '🏠' },
  { to: '/qa', label: '问答', icon: '💬' },
  { to: '/knowledge', label: '知识库', icon: '📚' },
  { to: '/chat', label: '聊天', icon: '💭' },
];

const AVATAR_COLORS = ['blue','green','red','purple','orange','indigo','emerald','sky','rose'];

function getAvatarColor(username) {
  const hash = Math.abs(username.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
  return AVATAR_COLORS[hash % 9];
}

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const { isDark, toggle } = useContext(ThemeContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
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
          <aside className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 min-h-[calc(100vh-48px)] p-2">
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
              <p className="text-[10px] text-gray-400 dark:text-gray-600">shsid &copy; 2025</p>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-48px)]">
          <div className="max-w-3xl mx-auto px-4 py-4 dark:text-gray-200">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
