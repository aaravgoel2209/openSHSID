import { useContext, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Avatar, AvatarImage, AvatarFallback } from '@heroui/react/avatar';
import { Dropdown, DropdownTrigger, DropdownPopover, DropdownMenu, DropdownItem } from '@heroui/react/dropdown';
import { ScrollShadow } from '@heroui/react/scroll-shadow';
import { SunIcon, MoonIcon, MagnifyingGlassIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';

const NAV_LINKS = [
  { to: '/qa', label: '问答' },
  { to: '/knowledge', label: '知识库' },
  { to: '/chat', label: '聊天' },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl transition-colors duration-300">
        <div className="max-w-5xl mx-auto flex h-16 items-center px-4 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-inherit no-underline shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">S</span>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent hidden sm:inline">
              SHSID 校园
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-all duration-200
                  ${isActive(to)
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className={`relative transition-all duration-200 ${searchFocused ? 'w-48 lg:w-64' : 'w-36 lg:w-48'}`}>
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="search-input"
              type="text"
              placeholder="搜索..."
              className="w-full h-9 pl-8 pr-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 dark:focus:border-indigo-600 transition-all duration-200"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
                  e.target.value = '';
                  e.target.blur();
                }
              }}
            />
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggle}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800 transition-all duration-200"
            title={isDark ? '切换浅色模式' : '切换深色模式'}
            aria-label={isDark ? '切换浅色模式' : '切换深色模式'}
          >
            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>

          {/* Ask Button */}
          <Button
            variant="flat"
            color="primary"
            size="sm"
            className="hidden sm:flex font-medium"
            onPress={() => navigate('/qa/ask')}
          >
            提问
          </Button>

          {/* User Area */}
          {user ? (
            <Dropdown>
              <DropdownTrigger>
                <Avatar
                  as="button"
                  className="cursor-pointer ring-2 ring-transparent hover:ring-indigo-200 dark:hover:ring-indigo-800 transition-all duration-200"
                  size="sm"
                  color="primary"
                >
                  <AvatarImage src={`/images/${getAvatarColor(user.username)}.jpg`} />
                  <AvatarFallback>{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </DropdownTrigger>
              <DropdownPopover>
                <DropdownMenu>
                  <DropdownItem key="info" textValue="用户名">
                    <p className="font-semibold">{user.username}</p>
                    <p className="text-xs text-default-500">已登录</p>
                  </DropdownItem>
                  <DropdownItem key="profile" onPress={() => navigate('/profile')}>
                    个人中心
                  </DropdownItem>
                  {user.is_staff && (
                    <DropdownItem key="admin" onPress={() => navigate('/admin')}>
                      管理面板
                    </DropdownItem>
                  )}
                  <DropdownItem key="logout" className="text-red-500 data-[hover]:bg-red-50 dark:text-red-400 dark:data-[hover]:bg-red-900/20" onPress={() => { logout(); navigate('/'); }}>
                    登出
                  </DropdownItem>
                </DropdownMenu>
              </DropdownPopover>
            </Dropdown>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="bordered" size="sm" className="font-medium" onPress={() => navigate('/login')}>登录</Button>
              <Button color="primary" variant="solid" size="sm" className="font-medium" onPress={() => navigate('/register')}>注册</Button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="菜单"
          >
            {mobileMenuOpen
              ? <XMarkIcon className="w-5 h-5" />
              : <Bars3Icon className="w-5 h-5" />
            }
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl animate-slide-up">
            <div className="max-w-5xl mx-auto px-4 py-3 space-y-1">
              {NAV_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-colors
                    ${isActive(to)
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                >
                  {label}
                </Link>
              ))}
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex gap-2">
                {user ? (
                  <Button variant="flat" color="primary" size="sm" fullWidth onPress={() => { navigate('/qa/ask'); setMobileMenuOpen(false); }}>
                    提问
                  </Button>
                ) : (
                  <>
                    <Button variant="bordered" size="sm" fullWidth onPress={() => { navigate('/login'); setMobileMenuOpen(false); }}>登录</Button>
                    <Button color="primary" size="sm" fullWidth onPress={() => { navigate('/register'); setMobileMenuOpen(false); }}>注册</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <ScrollShadow className="dark:text-gray-200" hideScrollBar>
          <Outlet />
        </ScrollShadow>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200/80 dark:border-slate-800/80 py-6 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-400 dark:text-gray-600">
          © 2025 SHSID 校园 · 为学生打造的知识社区
        </div>
      </footer>
    </div>
  );
}
