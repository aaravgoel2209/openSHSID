// 全局用户偏好唯一存储。
//
// 之前主题（localStorage 'theme'）、界面复杂度（'ui_complexity'）、后端地址
// （'shsid_server_url'）散落在不同模块各自的键里。这里把「外观类」偏好集中到
// 同一个 localStorage key（shsid_prefs），由 ThemeContext / UIContext / 设置页
// 统一读写，杜绝键名散落。首次读取时自动迁移旧键。
//
// 后端地址（shsid_server_url）属于「运行环境」而非「外观偏好」，仍由 config.js
// 单独管理——它需要在模块加载时同步求值（API_BASE 等常量），不适合走这里的异步订阅。

const PREFS_KEY = 'shsid_prefs';
const CHANGED_EVENT = 'shsid-prefs-changed';

// 默认主题色（与 HeroUI 默认主色 indigo-500 一致）；null 表示跟随默认，不改外观
export const DEFAULT_ACCENT = '#6366f1';

export const ACCENT_PRESETS = [
  { name: '靛蓝（默认）', value: null },
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '玫瑰', value: '#f43f5e' },
  { name: '翠绿', value: '#10b981' },
  { name: '琥珀', value: '#f59e0b' },
  { name: '青色', value: '#39c5bb' },
  { name: '石板', value: '#64748b' },
];

const DEFAULTS = {
  theme: null,         // null = 跟随系统 | 'light' | 'dark'
  ui_complexity: 'normal', // simple | normal | complex | extreme
  accent: null,        // null = 默认靛蓝 | '#rrggbb'
};

function parse(raw) {
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

// 读取偏好：合入默认值，并在首次读取时把旧版散落键迁移进来（只迁一次）
function load() {
  const stored = parse(localStorage.getItem(PREFS_KEY));
  const migrated = {};
  if (!stored) {
    const legacyTheme = localStorage.getItem('theme');
    const legacyComplexity = localStorage.getItem('ui_complexity');
    if (legacyTheme) migrated.theme = legacyTheme;
    if (legacyComplexity) migrated.ui_complexity = legacyComplexity;
    if (legacyTheme || legacyComplexity) {
      localStorage.removeItem('theme');
      localStorage.removeItem('ui_complexity');
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...DEFAULTS, ...migrated }));
    }
  }
  return { ...DEFAULTS, ...(stored || {}), ...migrated };
}

export function getPrefs() {
  return load();
}

export function updatePrefs(patch) {
  const next = { ...load(), ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: next }));
  return next;
}

// 订阅偏好变化（跨组件/跨标签页同步）。返回取消订阅函数。
export function subscribe(fn) {
  const handler = (e) => fn(e.detail || load());
  window.addEventListener(CHANGED_EVENT, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === PREFS_KEY) fn(parse(e.newValue) || load());
  });
  return () => {
    window.removeEventListener(CHANGED_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
