import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

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

export function renderMarkdown(text) {
  if (!text) return '';
  try {
    if (text.includes('<details>')) {
      return text.replace(
        /(<details>[\s\S]*?<\/details>)([\s\S]*)/,
        (_, details, rest) => {
          const parsed = rest ? renderMarkdown(rest) : '';
          return details + (parsed ? '\n\n' + parsed : '');
        }
      );
    }
    return marked.parse(text);
  } catch {
    return text.includes('<details>') ? text : simpleMarkdown(text);
  }
}
