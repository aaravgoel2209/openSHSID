import { useEffect, useState } from 'react';

// 防抖：value 停止变化 delay 毫秒后才更新返回值（搜索建议等高频输入场景）
export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
