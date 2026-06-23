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

// ========== 右侧边栏智能逻辑 ==========

/** 计算本周贡献趋势（基于 localStorage 历史快照） */
function calcTrend(currentTotal, key) {
  try {
    const raw = localStorage.getItem(`trend_${key}`);
    if (!raw) return { direction: 'same', percent: 0, message: '' };
    const prev = JSON.parse(raw);
    if (prev.length < 2) return { direction: 'same', percent: 0, message: '' };
    const recentAvg = prev.slice(-7).reduce((a, b) => a + b, 0) / Math.min(prev.length, 7);
    if (recentAvg === 0) return { direction: 'same', percent: 0, message: '' };
    const change = ((currentTotal - recentAvg) / recentAvg) * 100;
    const direction = change > 3 ? 'up' : change < -3 ? 'down' : 'same';
    const percent = Math.round(Math.abs(change));
    let message = '';
    if (direction === 'up') {
      message = `📈 较上周增长 ${percent}%`;
    } else if (direction === 'down') {
      message = `📉 较上周下降 ${percent}%`;
    } else {
      message = '📊 保持稳定';
    }
    return { direction, percent, message };
  } catch {
    return { direction: 'same', percent: 0, message: '' };
  }
}

/** 保存今日贡献快照 */
function saveSnapshot(total) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `snapshot_${today}`;
  const existing = JSON.parse(localStorage.getItem(key) || 'null');
  if (!existing) {
    localStorage.setItem(key, JSON.stringify({ date: today, total }));
  }
  // 维护滑动窗口（最近30天）
  const allKeys = Object.keys(localStorage).filter(k => k.startsWith('snapshot_')).sort();
  const values = allKeys.map(k => {
    const snap = JSON.parse(localStorage.getItem(k));
    return snap.total || 0;
  });
  localStorage.setItem('trend_total', JSON.stringify(values.slice(-30)));
}

/** 计算用户成就徽章列表 */
function computeAchievements(questionCount, answerCount, articleCount) {
  const badges = [];
  if (questionCount >= 5) badges.push({ emoji: '🧠', label: '学习先锋' });
  if (answerCount >= 10) badges.push({ emoji: '💡', label: '解答达人' });
  if (articleCount >= 3) badges.push({ emoji: '📝', label: '知识贡献者' });
  if (questionCount + answerCount + articleCount >= 50) badges.push({ emoji: '🏆', label: '社区之星' });
  return badges;
}

/** 基于用户行为给文章打分 */
function scoreArticles(articles, userTags, viewedIds, likedIds) {
  return articles.map(article => {
    let score = 0;
    // 标签重叠
    if (article.labels && userTags.length) {
      const artTags = Array.isArray(article.labels)
        ? article.labels.map(l => (typeof l === 'object' ? l.name : l))
        : [];
      const overlap = artTags.filter(t => userTags.includes(t)).length;
      score += overlap * 3;
    }
    // 浏览历史（越近期越高）
    if (viewedIds.includes(article.id)) {
      const order = viewedIds.indexOf(article.id);
      score += Math.max(1, 5 - order * 0.5);
    }
    // 点赞
    if (likedIds.includes(article.id)) score += 5;
    // 基础分（热度对数）
    if (article.views) score += Math.log10(article.views + 1) * 0.5;
    return { ...article, score };
  }).sort((a, b) => b.score - a.score);
}

/** 从 localStorage 读取用户偏好标签 */
function getUserTags() {
  try {
    const raw = localStorage.getItem('user_tags');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 从 localStorage 读取浏览历史 */
function getViewedIds() {
  try {
    const raw = localStorage.getItem('viewed_articles');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 从 localStorage 读取点赞历史 */
function getLikedIds() {
  try {
    const raw = localStorage.getItem('liked_articles');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 模拟公告板：根据用户兴趣标签智能排序 */
function smartAnnouncements(announcements, userTags) {
  if (!announcements || announcements.length === 0) return [];
  const tagged = announcements.map(ann => {
    let score = 0;
    if (ann.tags && userTags.length) {
      const overlap = ann.tags.filter(t => userTags.includes(t)).length;
      score += overlap * 2;
    }
    return { ...ann, score };
  });
  tagged.sort((a, b) => b.score - a.score);
  return tagged.slice(0, 5);
}

// =======================================

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const { isDark, toggle } = useContext(ThemeContext);
  const { complexity } = useUI();
  const topbarBlur = complexity !== 'simple';
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [now, setNow] = useState(new Date());

  // 用户贡献数据
  const [myQuestionCount, setMyQuestionCount] = useState(0);
  const [myAnswerCount, setMyAnswerCount] = useState(0);
  const [myArticleCount, setMyArticleCount] = useState(0);
  const [contribLoading, setContribLoading] = useState(false);
  const [trendMessage, setTrendMessage] = useState('');
  const [badges, setBadges] = useState([]);

  // 推荐知识库
  const [recommendArticles, setRecommendArticles] = useState([]);
  const [recoLoading, setRecoLoading] = useState(false);
  const [recoReason, setRecoReason] = useState('');

  // 公告板
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

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ========== 贡献数据 & 智能分析 ==========
  useEffect(() => {
    if (!user) {
      setMyQuestionCount(0);
      setMyAnswerCount(0);
      setMyArticleCount(0);
      setTrendMessage('');
      setBadges([]);
      setContribLoading(false);  // ← 修复：未登录时停止 loading
      return;
    }
    setContribLoading(true);
    const fetchData = async () => {
      try {
        const qs = await getQuestions();
        const myQ = qs.filter(q => q.author === user.id).length;
        setMyQuestionCount(myQ);
        const profile = await client.get('/auth/profile/');
        const myAns = profile.data.answer_count || 0;
        const myArt = profile.data.article_count || 0;
        setMyAnswerCount(myAns);
        setMyArticleCount(myArt);

        const total = myQ + myAns + myArt;
        // 保存快照 & 计算趋势
        saveSnapshot(total);
        const trend = calcTrend(total, 'total');
        setTrendMessage(trend.message);

        // 成就徽章
        setBadges(computeAchievements(myQ, myAns, myArt));
      } catch {
        // fallback
      } finally {
        setContribLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // ========== 推荐知识库（个性化排序） ==========
  useEffect(() => {
    setRecoLoading(true);
    getArticles()
      .then((articles) => {
        const userTags = getUserTags();
        const viewedIds = getViewedIds();
        const likedIds = getLikedIds();
        const scored = scoreArticles(articles, userTags, viewedIds, likedIds);
        const top = scored.slice(0, 3);
        setRecommendArticles(top);

        // 生成推荐理由
        if (top.length > 0 && userTags.length > 0) {
          const tagsInTop = [];
          top.forEach(a => {
            if (a.labels) {
              (Array.isArray(a.labels) ? a.labels.map(l => (typeof l === 'object' ? l.name : l)) : []).forEach(t => {
                if (userTags.includes(t) && !tagsInTop.includes(t)) tagsInTop.push(t);
              });
            }
          });
          if (tagsInTop.length > 0) {
            setRecoReason(`根据你对「${tagsInTop.slice(0, 2).join('、')}」的兴趣推荐`);
          } else if (viewedIds.length > 0) {
            setRecoReason('基于你的浏览历史推荐');
          } else {
            setRecoReason('');
          }
        } else if (top.length > 0) {
          setRecoReason('热门推荐');
        } else {
          setRecoReason('');
        }
      })
      .catch(() => setRecommendArticles([]))
      .finally(() => setRecoLoading(false));
  }, []);

  // ========== 公告板（智能排序） ==========
  useEffect(() => {
    setAnnLoading(true);
    client
      .get('/announcements/')
      .then((r) => {
        const raw = r.data.announcements || [];
        const userTags = getUserTags();
        const smart = smartAnnouncements(raw, userTags);
        setAnnouncements(smart);
      })
      .catch(() => {
        // 降级为本地模拟公告（含 tags）
        const fallback = [
          { title: '欢迎使用校园平台！', content: '更多功能即将上线。', tags: ['general'] },
          { title: '加入问答社区，分享知识', content: '你能帮助同学解答问题。', tags: ['qa'] },
          { title: '知识库新增 AI 推荐功能', content: '智能排序已上线。', tags: ['ai', 'knowledge'] },
        ];
        const userTags = getUserTags();
        setAnnouncements(smartAnnouncements(fallback, userTags));
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

        {/* Right Sidebar – 四个 tile (含智能逻辑) */}
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

          {/* Tile 2: 你的贡献 + 智能分析 */}
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
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  提问 <strong>{myQuestionCount}</strong> · 回答 <strong>{myAnswerCount}</strong> · 文章 <strong>{myArticleCount}</strong>
                </p>
                {trendMessage && (
                  <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">{trendMessage}</p>
                )}
                {badges.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {badges.map((b, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                        {b.emoji} {b.label}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </GlassPanel>

          {/* Tile 3: 推荐知识库 + 个性化理由 */}
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
              <>
                {recoReason && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 italic">{recoReason}</p>
                )}
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
              </>
            )}
          </GlassPanel>

          {/* Tile 4: 公告板 + 智能排序 */}
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
