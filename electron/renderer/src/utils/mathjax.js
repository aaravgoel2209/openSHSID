// MathJax 懒加载 + DOM 排版。用 SVG 输出（自包含、无外部字体文件），适合 PWA / Electron 离线。
// 关键点：
//  - 用真正的 <script> 标签加载 es5 合并包（而非当 ES 模块 import），避免 currentScript / 模块包裹问题；
//    通过 Vite 的 ?url 拿到打包后的资源地址，动态注入，按需加载（~2MB，只有出现公式才加载）。
//  - svg.fontCache='none'：每条公式内嵌字形路径、自包含。默认的 'local' 会把字形放进一个共享 <svg>
//    再用 <use> 跨容器引用；React 重渲染替换 innerHTML 时这些引用会失效，导致公式渲染成空白。
let loadingPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function ensureMathJax() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.MathJax?.typesetPromise) return Promise.resolve(window.MathJax);
  if (loadingPromise) return loadingPromise;

  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      processEnvironments: true,
    },
    svg: { fontCache: 'none' },
    options: {
      skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    },
    startup: { typeset: false },
  };

  loadingPromise = import('mathjax/es5/tex-mml-svg.js?url')
    .then((m) => loadScript(m.default))
    .then(() => window.MathJax.startup.promise)
    .then(() => window.MathJax)
    .catch((e) => {
      console.warn('[MathJax] 加载失败:', e);
      loadingPromise = null;
      return null;
    });
  return loadingPromise;
}

// 出现 $、\(、\[、\begin{ 才认为可能有公式，避免无谓加载
const MATH_RE = /\$|\\\(|\\\[|\\begin\{/;

export async function typesetMath(el) {
  if (!el || !MATH_RE.test(el.textContent || '')) return;
  const MJ = await ensureMathJax();
  if (!MJ?.typesetPromise) return;
  try {
    MJ.typesetClear?.([el]);
    await MJ.typesetPromise([el]);
  } catch {
    /* 单个公式排版失败不影响其它内容 */
  }
}
