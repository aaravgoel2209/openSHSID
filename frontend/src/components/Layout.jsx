import { useContext, useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@heroui/react/avatar';
import { Dropdown, DropdownTrigger, DropdownPopover, DropdownMenu, DropdownItem } from '@heroui/react/dropdown';
import { SunIcon, MoonIcon, PlusIcon, Bars3Icon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { useUI } from '../context/UIContext';
import NotificationBell from './NotificationBell';
import GlassPanel from './GlassPanel';
import AboutDialog from './AboutDialog';
import SubbarTeamPanel from './SubbarTeamPanel';
import { getAvatarColor } from '../utils/avatar';
import { localizeTitle } from '../utils/lang';
import { API_BASE, DJANGO_ORIGIN } from '../config';
import client from '../api/client';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Pick one background image per page load (module-level = runs once, stable across re-renders)
const _bgGlob = import.meta.glob('../assets/background/*.{jpg,jpeg,png,webp,avif,gif}', { eager: true });
const _bgUrls = Object.values(_bgGlob).map(m => m.default);
const RANDOM_BG = _bgUrls.length > 0 ? _bgUrls[Math.floor(Math.random() * _bgUrls.length)] : null;

const NAV_LINKS = [
  { to: '/', key: 'nav.home', icon: 'bi-house-fill' },
  { to: '/qa', key: 'nav.qa', icon: 'bi-chat-dots-fill' },
  { to: '/postbar', key: 'nav.postbar', icon: 'bi-people-fill' },
  { to: '/knowledge', key: 'nav.knowledge', icon: 'bi-journal-bookmark-fill' },
  { to: '/chat', key: 'nav.chat', icon: 'bi-chat-left-text-fill' },
  { to: '/mailbox', key: 'nav.mailbox', icon: 'bi-envelope-fill' },
  { to: '/linkedclassroom', key: 'nav.lc', icon: 'bi-grid-3x3-gap-fill' },
];


export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const { isDark, toggle } = useContext(ThemeContext);
  const { lang, setLang, t } = useLang();
  const { complexity, hasGlass } = useUI();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [now, setNow] = useState(new Date());

  const navIndex = useMemo(() => {
    const idx = NAV_LINKS.findIndex(l => location.pathname.startsWith(l.to));
    return idx >= 0 ? idx : 0;
  }, [location.pathname]);
  const prevIndex = useRef(navIndex);

  // 当前是否在浏览某个子吧 → 右栏显示「吧务团队」
  const activeSubbarId = useMemo(() => {
    const m = location.pathname.match(/^\/postbar\/b\/(\d+)/);
    return m ? m[1] : null;
  }, [location.pathname]);

  const [hotItems, setHotItems] = useState([]);
  const [weeklyTop, setWeeklyTop] = useState([]);
  const [notices, setNotices] = useState([]);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticePosting, setNoticePosting] = useState(false);
  const [showNoticeForm, setShowNoticeForm] = useState(false);

  // 屏幕尺寸状态
  const [isLargeScreen, setIsLargeScreen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    // 桌面端启用系统级毛玻璃（Win11 acrylic / macOS vibrancy）时不铺随机壁纸，
    // 让桌面背景透过窗口模糊呈现
    if (!RANDOM_BG || window.desktop?.nativeBlur) return;
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

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const large = window.innerWidth >= 1024;
      setIsLargeScreen(large);
      if (!large) {
        // 小屏时自动关闭侧边栏（浮动也关闭）
        setSidebarOpen(false);
      }
    };
    handleResize(); // 初始执行一次
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/auth/weekly-top/`).then(r => r.json()).then(setWeeklyTop).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/qa/questions/`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/knowledge/articles/`).then(r => r.json()).catch(() => []),
    ]).then(([qs, as]) => {
      const daysAgo = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0;
      const scored = [
        ...qs.map(q => ({ ...q, _heat: 2 + (q.views || 0) * 0.1 + (q.like_count || 0) * 0.3 + (q.answer_count || 0) * 0.2 - daysAgo(q.created_at) * 0.1, _type: '问答' })),
        ...as.map(a => ({ ...a, _heat: 2 + (a.views || 0) * 0.1 + (a.like_count || 0) * 0.3 - daysAgo(a.created_at) * 0.1, _type: '文章' })),
      ].sort((a, b) => b._heat - a._heat).slice(0, 5);
      setHotItems(scored);
    });
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/auth/notices/`).then(r => r.json()).then(setNotices).catch(() => {});
  }, []);

  async function postNotice() {
    if (!noticeTitle.trim()) return;
    setNoticePosting(true);
    try {
      const n = await client.post('/auth/notices/', { title: noticeTitle.trim(), content: noticeContent.trim() }).then(r => r.data);
      setNotices(prev => [n, ...prev]);
      setNoticeTitle('');
      setNoticeContent('');
      setShowNoticeForm(false);
    } catch { /* 提交失败：保留表单内容，让用户重试 */ } finally {
      setNoticePosting(false);
    }
  }

  async function deleteNotice(id) {
    await client.delete(`/auth/notices/${id}/`).catch(() => {});
    setNotices(prev => prev.filter(n => n.id !== id));
  }

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // 侧边栏内容（可复用）。collapsed=true 时只显示图标（折叠成窄轨）。
  const renderSidebar = (collapsed = false) => (
    <>
      {/* Create Post */}
      <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/qa/ask')}
        title={collapsed ? t('top.publish') : undefined}
        className={`w-full flex items-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium mb-3 transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
        <PlusIcon className="w-4 h-4 shrink-0" />
        {!collapsed && t('top.publish')}
      </motion.button>

      {/* Navigation */}
      <nav className="space-y-0.5">
        {NAV_LINKS.map(({ to, key, icon }) => (
          <Link key={to} to={to}
            title={collapsed ? t(key) : undefined}
            className={`flex items-center gap-2.5 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'} ${
              isActive(to)
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <i className={`bi ${icon} text-base shrink-0`} />
            {!collapsed && t(key)}
          </Link>
        ))}
      </nav>

      {/* User info */}
      {user?.is_staff && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
          <Link to="/admin/memory"
            title={collapsed ? t('nav.memory') : undefined}
            className={`flex items-center gap-2 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 no-underline transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'}`}
          >
            <i className="bi bi-cpu-fill text-sm shrink-0" /> {!collapsed && t('nav.memory')}
          </Link>
        </div>
      )}
      {user && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
          <div className={`flex items-center gap-2 py-2 ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            <Avatar size="sm" className="w-6 h-6 shrink-0">
              <AvatarImage src={user.avatar || `/images/${getAvatarColor(user.username)}.jpg`} />
              <AvatarFallback className="text-[9px]">{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            {!collapsed && <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{user.username}</span>}
          </div>
        </div>
      )}

      {/* Footer — 折叠时隐藏 */}
      {!collapsed && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 px-3">
          <p className="text-[10px] text-gray-400 dark:text-gray-600">沪ICP备2026030323号</p>
        </div>
      )}
    </>
  );

  const pageDirection = useMemo(() => {
    const diff = navIndex - (prevIndex.current ?? navIndex);
    prevIndex.current = navIndex;
    if (diff > 0) return 1;
    if (diff < 0) return -1;
    return 0;
  }, [navIndex]);

  return (
    // overflow-x-clip 而非 hidden：hidden 会把该 div 变成滚动容器，
    // 导致 sticky 顶栏失效（随页面滚走）；clip 只裁剪不产生滚动容器
    <div className="min-h-screen overflow-x-clip">
      {/* Top Bar */}
      <header className={`app-topbar sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 ${
        hasGlass ? 'bg-white/70 dark:bg-black/60 backdrop-blur-md' : 'bg-white dark:bg-black'
      }`}>
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/20 to-transparent" />
        <div className="app-topbar-row flex items-center h-12 px-3 gap-2 w-full">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500 relative w-8 h-8 flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={sidebarOpen ? 'close' : 'open'}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {sidebarOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
          <Link to="/" className="font-bold text-sm text-gray-900 dark:text-white no-underline shrink-0">openSHSID</Link>
          <div className="flex-1 max-w-md mx-auto min-w-0">
            <input
              type="text"
              placeholder={t('top.search')}
              className="w-full h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 text-xs dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-800 transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
                  e.target.value = '';
                }
              }}
            />
          </div>
          {/* 语言选择器 */}
          <Dropdown>
            <DropdownTrigger>
              {/* DropdownTrigger (react-aria Button) 自己就渲染一个真实 <button>，
                  子元素不能再是 button，否则 button 嵌 button 触发 DOM 校验警告 */}
              <motion.span whileTap={{ scale: 0.9 }} title={t('top.language')}
                className="flex items-center gap-1 px-2 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500 text-xs font-semibold cursor-pointer">
                <i className="bi bi-translate text-sm" />
                {lang === 'zh' ? '中' : 'EN'}
              </motion.span>
            </DropdownTrigger>
            <DropdownPopover>
              <DropdownMenu>
                <DropdownItem key="zh" onPress={() => setLang('zh')}>
                  {lang === 'zh' ? '✓ ' : ''}中文
                </DropdownItem>
                <DropdownItem key="en" onPress={() => setLang('en')}>
                  {lang === 'en' ? '✓ ' : ''}English
                </DropdownItem>
              </DropdownMenu>
            </DropdownPopover>
          </Dropdown>
          <motion.button whileTap={{ scale: 0.9 }} onClick={toggle} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500" title={isDark ? t('theme.light') : t('theme.dark')}>
            {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </motion.button>
          {/* 关于：显示当前构建版本信息（commit 首行） */}
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowAbout(true)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500" title={t('top.about')}>
            <i className="bi bi-info-circle text-sm" />
          </motion.button>
          <NotificationBell />
          {user ? (
            <Dropdown>
              <DropdownTrigger>
                <Avatar className="cursor-pointer w-7 h-7" size="sm" color="primary">
                  <AvatarImage src={user.avatar || `/images/${getAvatarColor(user.username)}.jpg`} />
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
                  {user.is_staff && <DropdownItem key="admin" onPress={() => navigate('/admin')}>管理面板</DropdownItem>}
                  {user.is_staff && <DropdownItem key="django-admin" onPress={() => window.open(`${DJANGO_ORIGIN}/admin/`, '_blank')}>数据库后台</DropdownItem>}
                  <DropdownItem key="logout" className="text-red-500" onPress={() => { logout(); navigate('/'); }}>登出</DropdownItem>
                </DropdownMenu>
              </DropdownPopover>
            </Dropdown>
          ) : (
            <div className="flex items-center gap-1">
              <motion.button whileTap={{ scale: 0.93 }} onClick={() => navigate('/login')} className="text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400">{t('top.login')}</motion.button>
              <motion.button whileTap={{ scale: 0.93 }} onClick={() => navigate('/register')} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">{t('top.register')}</motion.button>
            </div>
          )}
        </div>
      </header>

      <div className="flex w-full overflow-hidden">
        {/* 左侧边栏：大屏静态布局。折叠时收成只显示图标的窄轨，而非整体消失 */}
        {isLargeScreen && (
          <motion.aside
            key="sidebar-static"
            initial={false}
            animate={{ width: sidebarOpen ? 224 : 64 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className={`shrink-0 border-r border-gray-200 dark:border-gray-800 min-h-[calc(100vh-48px)] overflow-hidden ${
              hasGlass ? 'bg-white/60 dark:bg-black/60 backdrop-blur-md glass-shimmer' : 'bg-gray-50 dark:bg-gray-950'
            }`}
          >
            <div className="p-2">
              {renderSidebar(!sidebarOpen)}
            </div>
          </motion.aside>
        )}

        {/* 左侧边栏：小屏浮动 overlay */}
        <AnimatePresence>
          {!isLargeScreen && sidebarOpen && (
            <>
              <motion.div
                key="sidebar-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-40 bg-black/30"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                key="sidebar-panel"
                initial={{ x: -256 }}
                animate={{ x: 0 }}
                exit={{ x: -256 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className={`fixed left-0 top-12 z-50 w-56 h-[calc(100vh-48px)] border-r border-gray-200 dark:border-gray-800 p-2 ${
                  hasGlass ? 'bg-white/60 dark:bg-black/60 backdrop-blur-md' : 'bg-gray-50 dark:bg-gray-950'
                }`}
              >
                {renderSidebar(false)}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-48px)] min-w-0">
          <div className="w-full max-w-3xl mx-auto px-4 py-4 dark:text-gray-200">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, x: pageDirection * 20 }}
                animate={{ opacity: 1, x: 0, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, x: pageDirection * -20, transition: { duration: 0.15 } }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Right Sidebar – 四个 tile */}
        <aside className={`w-60 shrink-0 border-l border-gray-200 dark:border-gray-800 min-h-[calc(100vh-48px)] hidden lg:block p-3 ${
          hasGlass ? 'backdrop-blur-md bg-white/30 dark:bg-black/30' : ''
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
              {now.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </div>
          </GlassPanel>

          {/* 吧务团队（仅在子吧页显示） */}
          {activeSubbarId && <SubbarTeamPanel subbarId={activeSubbarId} />}

          {/* Your Contributions */}
          {user && (
            <GlassPanel
              className="mt-3"
              plainClass="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
              glassContentClass="p-3"
              cornerRadius={12}
            >
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t('side.contributions')}</h3>
              <div className="flex justify-around text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{user.question_count ?? 0}</p>
                  <p className="text-[10px] text-gray-400">{t('side.questions')}</p>
                </div>
                <div className="w-px bg-gray-100 dark:bg-gray-800" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{user.answer_count ?? 0}</p>
                  <p className="text-[10px] text-gray-400">{t('side.answers')}</p>
                </div>
                <div className="w-px bg-gray-100 dark:bg-gray-800" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{user.article_count ?? 0}</p>
                  <p className="text-[10px] text-gray-400">{t('side.articles')}</p>
                </div>
              </div>
            </GlassPanel>
          )}

          {/* Weekly Top Users */}
          <GlassPanel
            className="mt-3"
            plainClass="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
            glassContentClass="p-3"
            cornerRadius={12}
          >
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t('side.weeklyActive')}</h3>
            {weeklyTop.length === 0 ? (
              <p className="text-xs text-gray-400">{t('common.loading')}</p>
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
                      <p className="text-[10px] text-gray-400">{t('side.heat')} {u.total_heat}</p>
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
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t('side.hot')}</h3>
            {hotItems.length === 0 ? (
              <p className="text-xs text-gray-400">{t('common.loading')}</p>
            ) : (
              <div className="space-y-2">
                {hotItems.map((item, i) => (
                  <div key={`${item._type}-${item.id}`} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                    onClick={() => navigate(item._type === '问答' ? `/qa/questions/${item.id}` : `/knowledge/${item.id}`)}>
                    <span className="text-xs font-bold text-gray-400 w-4 shrink-0 mt-0.5">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{localizeTitle(item, lang)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{item._type === '问答' ? t('type.qa') : t('type.article')} · {item.views} {t('side.views')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>

          {/* Notice Board */}
          <GlassPanel
            className="mt-3"
            plainClass="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
            glassContentClass="p-3"
            cornerRadius={12}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('side.noticeBoard')}</h3>
              {user?.is_staff && (
                <button
                  onClick={() => setShowNoticeForm(v => !v)}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showNoticeForm ? t('side.cancel') : t('side.add')}
                </button>
              )}
            </div>

            {user?.is_staff && showNoticeForm && (
              <div className="mb-3 space-y-1.5">
                <input
                  value={noticeTitle}
                  onChange={e => setNoticeTitle(e.target.value)}
                  placeholder={t('side.noticeTitle')}
                  className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <textarea
                  value={noticeContent}
                  onChange={e => setNoticeContent(e.target.value)}
                  placeholder={t('side.noticeContent')}
                  rows={2}
                  className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                />
                <button
                  onClick={postNotice}
                  disabled={noticePosting || !noticeTitle.trim()}
                  className="w-full text-xs py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium transition-colors"
                >
                  {noticePosting ? t('side.posting') : t('side.publish')}
                </button>
              </div>
            )}

            {notices.length === 0 ? (
              <p className="text-xs text-gray-400">{t('side.noNotice')}</p>
            ) : (
              <ul className="space-y-2">
                {notices.map(n => (
                  <li key={n.id} className="group flex items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{n.title}</p>
                      {n.content && <p className="text-[10px] text-gray-400 mt-0.5">{n.content}</p>}
                      <p className="text-[10px] text-gray-300 dark:text-gray-600">{n.created_by} · {n.created_at}</p>
                    </div>
                    {user?.is_staff && (
                      <button
                        onClick={() => deleteNotice(n.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all mt-0.5"
                        title="删除"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </aside>
      </div>

      {/* 关于弹窗 */}
      <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />
    </div>
  );
}
