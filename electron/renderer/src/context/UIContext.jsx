import { useState, useCallback, useEffect } from 'react';
import { UIContext } from './uiContext';

// 界面复杂度：simple(兼容) | normal(普通) | complex(复杂) | extreme(极致)
// complex / extreme 会启用 liquid-glass 特效（extreme 更强：全站卡片玻璃化）
export function UIProvider({ children }) {
  const [complexity, setComplexityState] = useState(
    () => localStorage.getItem('ui_complexity') || 'normal'
  );

  // 把当前复杂度挂到 <html> 上，供全局 CSS（如 extreme 卡片玻璃、topbar 模糊）使用
  useEffect(() => {
    document.documentElement.dataset.uiComplexity = complexity;
  }, [complexity]);

  const setComplexity = useCallback((value) => {
    setComplexityState(value);
    localStorage.setItem('ui_complexity', value);
  }, []);

  const hasGlass = complexity !== 'simple';

  return (
    <UIContext.Provider value={{ complexity, setComplexity, hasGlass }}>
      {children}
    </UIContext.Provider>
  );
}
