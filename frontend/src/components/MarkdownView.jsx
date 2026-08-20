import { useRef, useEffect } from 'react';
import { renderMarkdown } from '../utils/markdown';
import { typesetMath } from '../utils/mathjax';

// 渲染 Markdown 并用 MathJax 排版其中的公式（$...$、$$...$$、\(...\)、\[...\]）。
// 用法：<MarkdownView markdown={text} className="md-body" />，或传已渲染好的 html。
// as 仅支持两处用法：默认 'div'，或 'span' 匹配内联布局（全站调用点只有这两种）。
// 标签名写成字面量分支：动态 as 会让 eslint 无法证明目标是宿主元素（react-hooks/refs）。
export default function MarkdownView({ markdown, html, as = 'div', className, ...rest }) {
  const ref = useRef(null);
  const __html = html != null ? html : renderMarkdown(markdown || '');
  useEffect(() => { typesetMath(ref.current); }, [__html]);
  const sharedProps = { ref, className, dangerouslySetInnerHTML: { __html }, ...rest };
  if (as === 'span') return <span {...sharedProps} />;
  return <div {...sharedProps} />;
}
