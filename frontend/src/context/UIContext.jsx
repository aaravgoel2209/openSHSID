import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

const UIContext = createContext(null);

export const useUI = () => useContext(UIContext);

const LEVELS = ['simple', 'normal', 'complex', 'extreme'];

// 界面复杂度：
//   simple   — 兼容模式，无装饰
//   normal   — 默认，轻微玻璃效果
//   complex  — 启用 @khvicha/react-liquid-glass 液态玻璃
//   extreme  — 最强液态玻璃 + 全站卡片强制玻璃化
export function UIProvider({ children }) {
  const [complexity, setComplexityState] = useState(
    () => {
      const saved = localStorage.getItem('ui_complexity');
      return LEVELS.includes(saved) ? saved : 'normal';
    }
  );

  useEffect(() => {
    document.documentElement.dataset.uiComplexity = complexity;
  }, [complexity]);

  const setComplexity = useCallback((value) => {
    if (!LEVELS.includes(value)) return;
    setComplexityState(value);
    localStorage.setItem('ui_complexity', value);
  }, []);

  const hasGlass = useMemo(() => complexity !== 'simple', [complexity]);
  const isLiquid = useMemo(() => complexity === 'complex' || complexity === 'extreme', [complexity]);

  return (
    <UIContext.Provider value={{ complexity, setComplexity, hasGlass, isLiquid }}>
      {children}
    </UIContext.Provider>
  );
}
