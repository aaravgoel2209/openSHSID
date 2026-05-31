import { useContext } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Avatar } from '@heroui/react/avatar';
import { Dropdown, DropdownTrigger, DropdownPopover, DropdownMenu, DropdownItem } from '@heroui/react/dropdown';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const { isDark, toggle } = useContext(ThemeContext);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60 transition-colors">
        <div className="max-w-5xl mx-auto flex h-14 items-center px-4">
            <Link to="/" className="text-lg font-bold text-inherit no-underline mr-8 dark:text-white">
              SHSID 校园
            </Link>
            <nav className="hidden sm:flex items-center gap-6 mr-auto">
              <Link to="/qa" className="text-sm text-gray-600 dark:text-gray-400 no-underline hover:text-primary dark:hover:text-primary">
                问答
              </Link>
            <Link to="/knowledge" className="text-sm text-gray-600 dark:text-gray-400 no-underline hover:text-primary dark:hover:text-primary">
              知识库
            </Link>
            <Link to="/chat" className="text-sm text-gray-600 dark:text-gray-400 no-underline hover:text-primary dark:hover:text-primary">
              聊天
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              title={isDark ? '切换浅色模式' : '切换深色模式'}
            >
              {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            <Button
              variant="flat"
              color="primary"
              size="sm"
              onPress={() => navigate('/ask')}
            >
              提问
            </Button>
            {user ? (
              <Dropdown>
                <DropdownTrigger>
                  <Avatar
                    as="button"
                    className="cursor-pointer"
                    name={user.username?.charAt(0).toUpperCase()}
                    size="sm"
                    color="primary"
                  />
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
                    <DropdownItem key="logout" color="danger" onPress={() => { logout(); navigate('/'); }}>
                      登出
                    </DropdownItem>
                  </DropdownMenu>
                </DropdownPopover>
              </Dropdown>
            ) : (
              <>
                <Button variant="bordered" size="sm" onPress={() => navigate('/login')}>登录</Button>
                <Button color="primary" variant="solid" size="sm" onPress={() => navigate('/register')}>注册</Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 dark:text-gray-200">
        <Outlet />
      </main>
    </div>
  );
}
