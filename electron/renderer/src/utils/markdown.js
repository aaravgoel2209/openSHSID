import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ breaks: true, gfm: true });

// 用户内容经 dangerouslySetInnerHTML 渲染，必须过一遍 sanitize 防 XSS。
// 保留 <details>/<summary>（AI 思考块）与常规排版标签。
const PURIFY_OPTS = {
  ADD_TAGS: ['details', 'summary'],
  ADD_ATTR: ['open'],
  FORBID_TAGS: ['style', 'form', 'input', 'iframe'],
};

// 站内链接在新窗口打开外链、站内正常跳转；给外链补 rel
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    const href = node.getAttribute('href');
    if (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});

function simpleMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function renderRaw(text) {
  try {
    if (text.includes('<details>')) {
      return text.replace(
        /(<details>[\s\S]*?<\/details>)([\s\S]*)/,
        (_, details, rest) => {
          const parsed = rest ? marked.parse(rest) : '';
          return details + (parsed ? '\n\n' + parsed : '');
        }
      );
    }
    return marked.parse(text);
  } catch {
    return simpleMarkdown(text);
  }
}

export function renderMarkdown(text) {
  if (!text) return '';
  return DOMPurify.sanitize(renderRaw(text), PURIFY_OPTS);
}
