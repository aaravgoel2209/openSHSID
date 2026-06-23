import { useContext, useState, useEffect, useRef } from 'react';

// Pick one background image per page load (module-level = runs once, stable across re-renders).
// Drop images into frontend/src/assets/background/ and they're picked up automatically.
const _bgGlob = import.meta.glob('../assets/background/*.{jpg,jpeg,png,webp,avif,gif}', { eager: true });
const _bgUrls = Object.values(_bgGlob).map(m => m.default);
const RANDOM_BG = _bgUrls.length > 0 ? _bgUrls[Math.floor(Math.random() * _bgUrls.length)] : null;
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@heroui/react/avatar';
import { Dropdown, DropdownTrigger, DropdownPopover, DropdownMenu, DropdownItem } from '@heroui/react/dropdown';
import { Spinner } from '@heroui/react/spinner';
import { SunIcon, MoonIcon, PlusIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useUI } from '../context/UIContext';
import NotificationBell from './NotificationBell';
import GlassPanel from './GlassPanel';
import { getQuestions } from '../api/qa';
import { getArticles } from '../api/knowledge';
import client from '../api/client';

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
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [now, setNow] = useState(new Date());

  // 右侧边栏数据
  const [myQuestionCount, setMyQuestionCount] = useState(0);
  const [myAnswerCount, setMyAnswerCount] = useState(0);
  const [myArticleCount, setMyArticleCount] = useState(0);
  const [recommendArticles, setRecommendArticles] = useState([]);
  const [recoLoading, setRecoLoading] = useState(false);
  const [contribLoading, setContribLoading] = useState(false);
  const [announcements, setAnnouncements] = useState(null);
  const [annLoading, setAnnLoading] = useState(false);

  useEffect(() => {
    if (!RANDOM_BG) return;
    const html = document.documentElement;
    html.style.backgroundImage = `url(${RANDOM_BG})`;
    html.style.backgroundSize = 'cover';
    html.style.backgroundAttachment = 'fixed';
    html.style.backgroundPosition = 'center';
    return () => {
      html.style.backgroundImage = '';
      html.style.backgroundSize = '';
      html.style.backgroundAttachment = '';
      html.style.backgroundPosition = '';
    };
  }, []);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // 用户贡献数据
  useEffect(() => {
    if (!user) {
      setMyQuestionCount(0);
      setMyAnswerCount(0);
      setMyArticleCount(0);
      return;
    }
    setContribLoading(true);
    getQuestions()
      .then((qs) => {
        setMyQuestionCount(qs.filter((q) => q.author === user.id).length);
      })
      .catch(() => setMyQuestionCount(0));
    client
      .get('/auth/profile/')
      .then((r) => {
        setMyAnswerCount(r.data.answer_count || 0);
        setMyArticleCount(r.data.article_count || 0);
      })
      .catch(() => {})
      .finally(() => setContribLoading(false));
  }, [user]);

  // 推荐知识库
  useEffect(() => {
    setRecoLoading(true);
    getArticles()
      .then((articles) => {
        setRecommendArticles(articles.slice(0, 3));
      })
      .catch(() => setRecommendArticles([]))
      .finally(() => setRecoLoading(false));
  }, []);

  // 公告板（尚无 API，先占位）
  useEffect(() => {
    setAnnLoading(true);
    client
      .get('/announcements/')
      .then((r) => {
        setAnnouncements(r.data.announcements || []);
      })
      .catch(() => {
        setAnnouncements([
          { title: '欢迎使用校园平台！', content: '更多功能即将上线。' },
        ]);
      })
      .finally(() => setAnnLoading(false));
  }, []);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen">
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

        {/* Right Sidebar – 四个 tile */}
        <aside className={`w-60 shrink-0 border-l border-gray-200 dark:border-gray-800 min-h-[calc(100vh-48px)] hidden lg:block p-3 ${
          topbarBlur ? ' backdrop-blur-md' : ''
        }`}>
          {/* Tile 1: 实时时钟 */}
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

          {/* Tile 2: 你的贡献 */}
          <GlassPanel
            className="mt-3"
            plainClass="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
            glassContentClass="p-3"
            cornerRadius={12}
          >
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">你的贡献</h3>
            {contribLoading ? (
              <Spinner size="sm" />
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                你提出了 <strong>{myQuestionCount}</strong> 个问题，
                回答了 <strong>{myAnswerCount}</strong> 个回答，
                发表了 <strong>{myArticleCount}</strong> 篇文章。
              </p>
            )}
          </GlassPanel>

          {/* Tile 3: 推荐知识库 */}
          <GlassPanel
            className="mt-3"
            plainClass="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
            glassContentClass="p-3"
            cornerRadius={12}
          >
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">推荐知识库</h3>
            {recoLoading ? (
              <Spinner size="sm" />
            ) : recommendArticles.length === 0 ? (
              <p className="text-xs text-gray-400">暂无推荐</p>
            ) : (
              <ul className="space-y-1">
                {recommendArticles.map((a) => (
                  <li key={a.id}>
                    <button
                      className="text-xs text-left text-indigo-600 dark:text-indigo-400 hover:underline truncate w-full"
                      onClick={() => navigate(`/knowledge/${a.id}`)}
                    >
                      {a.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>

          {/* Tile 4: 公告板 */}
          <GlassPanel
            className="mt-3"
            plainClass="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
            glassContentClass="p-3"
            cornerRadius={12}
          >
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">公告板</h3>
            {annLoading ? (
              <Spinner size="sm" />
            ) : announcements && announcements.length > 0 ? (
              <ul className="space-y-1">
                {announcements.map((ann, idx) => (
                  <li key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                    <div className="font-medium">{ann.title}</div>
                    {ann.content && <div className="text-gray-400">{ann.content}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">暂无公告</p>
            )}
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}
