import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Electron 桌面端：挂标记类，启用系统级毛玻璃与自定义标题栏样式
// （网页端没有 window.desktop，此段完全跳过）
const desktop = window.desktop;
if (desktop?.isElectron) {
  const root = document.documentElement;
  root.classList.add('is-electron', `platform-${desktop.platform}`);
  if (desktop.nativeBlur) root.classList.add('native-blur');
  if (desktop.overlayControls) root.classList.add('overlay-controls');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
