import { useContext, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Avatar, AvatarImage, AvatarFallback } from '@heroui/react/avatar';
import { Dropdown, DropdownTrigger, DropdownPopover, DropdownMenu, DropdownItem } from '@heroui/react/dropdown';
import { ScrollShadow } from '@heroui/react/scroll-shadow';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const { isDark, toggle } = useContext(ThemeContext);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors">
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60 transition-colors">
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
            <input
              id="search-input"
              type="text"
              placeholder="搜索..."
              className="w-32 lg:w-48 h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-slate-950 text-sm dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
                  e.target.value = '';
                }
              }}
            />
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
              onPress={() => navigate('/qa/ask')}
            >
              提问
            </Button>
            {user ? (
              <Dropdown>
                <DropdownTrigger>
                  <Avatar
                    as="button"
                    className="cursor-pointer"
                    size="sm"
                    color="primary"
                  >
                    <AvatarImage src={`/images/${['blue','green','red','purple','orange','indigo','emerald','sky','rose'][Math.abs(user.username.split('').reduce((a,c)=>a*31+c.charCodeAt(0),0))%9]}.jpg`} />
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
                    <DropdownItem key="logout" className="text-red-500 data-[hover]:bg-red-50 dark:text-red-400 dark:data-[hover]:bg-red-900/20" onPress={() => { logout(); navigate('/'); }}>
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
      <ScrollShadow className="max-w-4xl mx-auto px-4 py-6 dark:text-gray-300" hideScrollBar>
        <Outlet />
      </ScrollShadow>
    </div>
  );
}
