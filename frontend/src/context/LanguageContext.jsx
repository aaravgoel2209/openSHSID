import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { STRINGS } from '../i18n';

export const LanguageContext = createContext({ lang: 'zh', setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem('lang');
    if (saved === 'zh' || saved === 'en') return saved;
    // 浏览器语言以 zh 开头则默认中文，否则英文
    return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
  }, [lang]);

  const setLang = useCallback((l) => {
    if (l === 'zh' || l === 'en') setLangState(l);
  }, []);

  // 翻译 UI 文案：t('key')，缺失则回退到中文再回退到 key 本身
  const t = useCallback(
    (key) => (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.zh[key] || key,
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
