import { useRef, useEffect, createElement } from 'react';
import { renderMarkdown } from '../utils/markdown';
import { typesetMath } from '../utils/mathjax';

// 渲染 Markdown 并用 MathJax 排版其中的公式（$...$、$$...$$、\(...\)、\[...\]）。
// 用法：<MarkdownView markdown={text} className="md-body" />，或传已渲染好的 html。
// as 可设为 'span' 等以匹配原有内联布局。
export default function MarkdownView({ markdown, html, as = 'div', className, ...rest }) {
  const ref = useRef(null);
  const __html = html != null ? html : renderMarkdown(markdown || '');
  useEffect(() => { typesetMath(ref.current); }, [__html]);
  return createElement(as, { ref, className, dangerouslySetInnerHTML: { __html }, ...rest });
}
