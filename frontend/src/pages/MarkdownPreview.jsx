import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import {
  ArrowLeftIcon, ArrowDownTrayIcon, PrinterIcon, TrashIcon, ClipboardIcon, CheckIcon,
} from '@heroicons/react/24/outline';
import MarkdownView from '../components/MarkdownView';
import { copyText as copyToClipboard } from '../utils/clipboard';

const SAMPLE = `# Markdown 预览器

在左边输入 **Markdown**，右边实时预览，点「导出 PDF」即可保存或打印。

## 支持的语法

- 列表、**加粗**、*斜体*、\`行内代码\`
- [链接](https://www.shsid.org)
- 表格、引用、代码块

> 引用块也能正常渲染。

| 学科 | 考试日期 |
| --- | --- |
| 微积分 BC | 5 月 4 日 |
| 物理 C | 5 月 5 日 |

行内公式 $E = mc^2$，以及独立公式：

$$\\int_0^1 x^2 \\,dx = \\frac{1}{3}$$

\`\`\`python
def hello():
    print("Hello, SHSID!")
\`\`\`
`;

// 打印用样式：自包含浅色主题（PDF 应为浅底），镜像 index.css 里 .md-body 的排版。
const PRINT_CSS = `
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1f2937; font-family: -apple-system, "Segoe UI", "Microsoft YaHei", Roboto, sans-serif; }
  .md-body { line-height: 1.7; word-break: break-word; font-size: 12pt; }
  .md-body > :first-child { margin-top: 0; }
  .md-body h1, .md-body h2, .md-body h3, .md-body h4 { font-weight: 700; margin: 1.1em 0 0.5em; line-height: 1.3; }
  .md-body h1 { font-size: 1.9em; }
  .md-body h2 { font-size: 1.5em; }
  .md-body h3 { font-size: 1.25em; }
  .md-body h4 { font-size: 1.1em; }
  .md-body p { margin: 0.6em 0; }
  .md-body ul, .md-body ol { margin: 0.6em 0; padding-left: 1.5em; }
  .md-body ul { list-style: disc; }
  .md-body ol { list-style: decimal; }
  .md-body li { margin: 0.25em 0; }
  .md-body a { color: #4f46e5; text-decoration: underline; text-underline-offset: 2px; }
  .md-body code { font-family: ui-monospace, Consolas, "Courier New", monospace; font-size: 0.875em; background: rgba(99,102,241,0.08); border-radius: 4px; padding: 0.15em 0.4em; }
  .md-body pre { background: #f6f8fa; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 0.8em 1em; overflow-x: auto; margin: 0.8em 0; page-break-inside: avoid; }
  .md-body pre code { background: none; padding: 0; }
  .md-body blockquote { border-left: 3px solid #c7d2fe; padding: 0.1em 0 0.1em 0.9em; margin: 0.8em 0; color: #4b5563; }
  .md-body table { border-collapse: collapse; margin: 0.8em 0; font-size: 0.9em; }
  .md-body th, .md-body td { border: 1px solid #d1d5db; padding: 0.4em 0.8em; }
  .md-body th { background: rgba(99,102,241,0.06); font-weight: 600; }
  .md-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.2em 0; }
  .md-body img { max-width: 100%; }
  .md-body h1, .md-body h2, .md-body h3 { page-break-after: avoid; }
`;

export default function MarkdownPreview() {
  const navigate = useNavigate();
  const [md, setMd] = useState(SAMPLE);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef(null);

  // 用隐藏 iframe 打印预览内容：预览里的公式已由 MathJax 渲染成内联 SVG（fontCache='none'，
  // 字形自包含），连同 md-body 排版一起写进 iframe 即可离线打印/导出 PDF，不依赖网络或主文档布局。
  const exportPdf = () => {
    const node = previewRef.current;
    if (!node) return;
    const inner = node.innerHTML;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0',
    });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<title>Markdown 导出</title><style>${PRINT_CSS}</style></head>` +
      `<body>${inner}</body></html>`
    );
    doc.close();
    // 给一帧时间完成布局，再唤起打印；打印对话框关闭后移除 iframe。
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.warn('[MarkdownPreview] 打印失败:', e);
      }
      setTimeout(() => iframe.remove(), 1000);
    }, 250);
  };

  const downloadMd = () => {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `文档_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyMd = async () => {
    if (await copyToClipboard(md)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate('/toolbox')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" /> 返回工具箱
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <i className="bi bi-markdown text-indigo-500" /> Markdown 预览器
        </h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="flat" onPress={copyMd} startContent={copied ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}>
            {copied ? '已复制' : '复制'}
          </Button>
          <Button size="sm" variant="flat" onPress={downloadMd} startContent={<ArrowDownTrayIcon className="w-4 h-4" />}>
            下载 .md
          </Button>
          <Button size="sm" color="primary" onPress={exportPdf} startContent={<PrinterIcon className="w-4 h-4" />}>
            导出 PDF
          </Button>
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        左侧编辑 Markdown（支持表格、代码块与 $公式$），右侧实时预览，可导出为 PDF 或下载源文件。
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 编辑区 */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">编辑</span>
            <button
              onClick={() => setMd('')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <TrashIcon className="w-3.5 h-3.5" /> 清空
            </button>
          </div>
          <textarea
            value={md}
            onChange={(e) => setMd(e.target.value)}
            spellCheck={false}
            placeholder="在这里输入 Markdown…"
            className="w-full h-[65vh] resize-none rounded-2xl border border-gray-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-4 text-sm font-mono leading-relaxed text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        {/* 预览区 */}
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">预览</span>
          <div ref={previewRef} className="h-[65vh] overflow-y-auto rounded-2xl border border-gray-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-5">
            {md.trim()
              ? <MarkdownView className="md-body text-gray-700 dark:text-gray-300" markdown={md} />
              : <p className="text-sm text-gray-400 dark:text-gray-500">预览会显示在这里…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
