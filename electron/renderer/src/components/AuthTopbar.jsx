import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { ThemeContext } from '../context/themeContext';
import { useLang } from '../context/useLang';
import AboutDialog from './AboutDialog';

// 登录/注册页没有 Layout，用不上侧边栏/搜索/通知——只留 Electron 需要的部分：
// 拖拽区（否则隐藏系统标题栏后窗口无法拖动）+ 主题切换 + 关于，浮在背景图上方。
export default function AuthTopbar() {
  const { isDark, toggle } = useContext(ThemeContext);
  const { t } = useLang();
  const navigate = useNavigate();
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <header className="app-topbar fixed top-0 inset-x-0 z-50">
        <div className="app-topbar-row flex items-center h-12 px-3 gap-1 w-full">
          <button
            onClick={() => navigate('/')}
            className="font-bold text-sm text-white no-underline shrink-0 drop-shadow-md hover:opacity-80 transition-opacity"
          >
            openSHSID
          </button>
          <div className="flex-1" />
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 drop-shadow-md"
            title={isDark ? t('theme.light') : t('theme.dark')}
          >
            {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowAbout(true)}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 drop-shadow-md"
            title={t('top.about')}
          >
            <i className="bi bi-info-circle text-sm" />
          </button>
        </div>
      </header>
      <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />
    </>
  );
}
