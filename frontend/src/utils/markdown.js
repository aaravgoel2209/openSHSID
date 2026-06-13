import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

export function renderMarkdown(html) {
  if (!html) return '';
  if (html.includes('<details>')) {
    // Has AI reasoning — only parse the part outside details tags
    return html.replace(
      /(<details>.*?<\/details>)([\s\S]*)/,
      (_, details, rest) => details + (rest ? '\n\n' + marked.parse(rest) : '')
    );
  }
  return marked.parse(html);
}
