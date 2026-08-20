import { useState, useEffect, useCallback } from 'react';
import { getPrefs, updatePrefs, subscribe } from '../config/prefs';
import { ThemeContext } from './themeContext';

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = getPrefs().theme;
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 个性化主题色：null = 默认（不挂 data-accent，外观与默认一致）
  const [accent, setAccent] = useState(() => getPrefs().accent || null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    updatePrefs({ theme: isDark ? 'dark' : 'light' });
    // Electron 桌面端：同步窗口控制按钮（最小化/最大化/关闭）配色
    window.desktop?.setTheme?.(isDark);
  }, [isDark]);

  // 应用主题色：HeroUI 主色组件由 --accent 驱动；Tailwind 硬编码 accent 类
  // 通过 data-accent 重新映射（见 index.css）。未设置自定义色时保持默认外观。
  useEffect(() => {
    const root = document.documentElement;
    if (accent) {
      root.style.setProperty('--user-accent', accent);
      root.dataset.accent = accent;
    } else {
      root.style.removeProperty('--user-accent');
      delete root.dataset.accent;
    }
  }, [accent]);

  // 设置页改色 / 其他标签页改偏好 → 立即同步
  useEffect(() => subscribe((prefs) => {
    setAccent(prefs.accent || null);
    if (prefs.theme) setIsDark(prefs.theme === 'dark');
  }), []);

  const toggle = useCallback(() => setIsDark((d) => !d), []);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
