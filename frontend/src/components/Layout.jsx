import { useContext } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Avatar } from '@heroui/react/avatar';
import { Dropdown, DropdownTrigger, DropdownPopover, DropdownMenu, DropdownItem } from '@heroui/react/dropdown';
import { AuthContext } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-5xl mx-auto flex h-14 items-center px-4">
          <Link to="/" className="text-lg font-bold text-inherit no-underline mr-8">
            SHSID 校园
          </Link>
          <nav className="hidden sm:flex items-center gap-6 mr-auto">
            <Link to="/" className="text-sm text-gray-600 no-underline hover:text-primary">
              问答
            </Link>
            <Link to="/knowledge" className="text-sm text-gray-600 no-underline hover:text-primary">
              知识库
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              as={Link}
              to="/ask"
              variant="flat"
              color="primary"
              size="sm"
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
                  <DropdownMenu onAction={(key) => {
                    if (key === 'profile') navigate('/profile');
                    if (key === 'logout') { logout(); navigate('/'); }
                  }}>
                    <DropdownItem key="info" textValue="用户名">
                      <p className="font-semibold">{user.username}</p>
                      <p className="text-xs text-default-500">已登录</p>
                    </DropdownItem>
                    <DropdownItem key="profile">个人中心</DropdownItem>
                    <DropdownItem key="logout" className="text-danger">登出</DropdownItem>
                  </DropdownMenu>
                </DropdownPopover>
              </Dropdown>
            ) : (
              <>
                <Button as={Link} to="/login" variant="light" size="sm">登录</Button>
                <Button as={Link} to="/register" color="primary" variant="flat" size="sm">注册</Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
