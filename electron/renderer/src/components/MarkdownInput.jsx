import { useRef, useState } from 'react';
import { useLang } from '../context/LanguageContext';
import MarkdownView from './MarkdownView';

// Markdown 输入框：工具栏（加粗/斜体/代码/链接/列表…）+ 编辑/预览切换。
// 受控组件：onChange 直接收新字符串（非事件对象）。
// compact 模式用于嵌套回复等小输入位，只保留常用按钮。

const TABLE_TEMPLATE = '| 列1 | 列2 |\n| --- | --- |\n|     |     |\n';

// type: wrap（选区两侧包裹）| line（选中行加前缀）| block（插入模板块）
const ACTIONS = [
  { key: 'md.bold', icon: 'bi-type-bold', type: 'wrap', left: '**', sample: 'bold', compact: true },
  { key: 'md.italic', icon: 'bi-type-italic', type: 'wrap', left: '*', sample: 'italic', compact: true },
  { key: 'md.strikethrough', icon: 'bi-type-strikethrough', type: 'wrap', left: '~~', sample: 'text' },
  { key: 'md.heading', icon: 'bi-type-h2', type: 'line', prefix: '## ' },
  { key: 'md.code', icon: 'bi-code', type: 'wrap', left: '`', sample: 'code', compact: true },
  { key: 'md.codeblock', icon: 'bi-code-square', type: 'block', template: '```\ncode\n```', select: 'code' },
  { key: 'md.link', icon: 'bi-link-45deg', type: 'wrap', left: '[', right: '](https://)', sample: 'link', compact: true },
  { key: 'md.quote', icon: 'bi-blockquote-left', type: 'line', prefix: '> ', compact: true },
  { key: 'md.ul', icon: 'bi-list-ul', type: 'line', prefix: '- ' },
  { key: 'md.ol', icon: 'bi-list-ol', type: 'line', ordered: true },
  { key: 'md.table', icon: 'bi-table', type: 'block', template: TABLE_TEMPLATE, select: '列1' },
];

export default function MarkdownInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 3,
  compact = false,
  required = false,
}) {
  const { t } = useLang();
  const taRef = useRef(null);
  const [preview, setPreview] = useState(false);

  const apply = (action) => {
    const ta = taRef.current;
    if (!ta || disabled) return;
    const s = ta.selectionStart ?? value.length;
    const e = ta.selectionEnd ?? value.length;
    const before = value.slice(0, s);
    const sel = value.slice(s, e);
    const after = value.slice(e);
    let next, selStart, selEnd;

    if (action.type === 'wrap') {
      const left = action.left;
      const right = action.right ?? action.left;
      const text = sel || action.sample;
      next = before + left + text + right + after;
      selStart = s + left.length;
      selEnd = selStart + text.length;
    } else if (action.type === 'line') {
      // 选中的每一行加前缀（有序列表按序号）；确保从行首开始
      const lead = before && !before.endsWith('\n') ? '\n' : '';
      const lines = (sel || '').split('\n').map((ln, i) =>
        (action.ordered ? `${i + 1}. ` : action.prefix) + ln);
      const inserted = lines.join('\n');
      next = before + lead + inserted + after;
      selStart = s + lead.length;
      selEnd = selStart + inserted.length;
    } else {
      // block：光标处另起一段插入模板，选中模板中的占位词
      const lead = !before ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
      next = before + lead + action.template + '\n' + after;
      const idx = action.template.indexOf(action.select);
      selStart = s + lead.length + (idx >= 0 ? idx : 0);
      selEnd = selStart + (idx >= 0 ? action.select.length : 0);
    }

    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(selStart, selEnd);
    });
  };

  const actions = compact ? ACTIONS.filter((a) => a.compact) : ACTIONS;
  const btnBase = `rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800
    hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-40
    ${compact ? 'w-6 h-6 text-xs' : 'w-7 h-7 text-sm'} flex items-center justify-center`;

  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900
      focus-within:ring-2 focus-within:ring-blue-500/20 overflow-hidden ${disabled ? 'opacity-70' : ''}`}>
      {/* 工具栏 */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40 flex-wrap">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            tabIndex={-1}
            title={t(a.key)}
            disabled={disabled || preview}
            onClick={() => apply(a)}
            className={btnBase}
          >
            <i className={`bi ${a.icon}`} />
          </button>
        ))}
        <button
          type="button"
          tabIndex={-1}
          title={preview ? t('md.edit') : t('md.preview')}
          disabled={disabled}
          onClick={() => setPreview((v) => !v)}
          className={`${btnBase} ml-auto ${preview ? '!text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : ''}`}
        >
          <i className={`bi ${preview ? 'bi-pencil' : 'bi-eye'}`} />
        </button>
      </div>

      {/* 编辑 / 预览 */}
      {preview ? (
        <div className={`md-body px-3 py-2 text-sm text-gray-700 dark:text-gray-300 ${compact ? 'min-h-[3.5rem]' : 'min-h-[5rem]'}`}>
          {value.trim()
            ? <MarkdownView markdown={value} />
            : <p className="text-gray-400">{t('md.previewEmpty')}</p>}
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={compact ? Math.min(rows, 2) : rows}
          className="w-full px-3 py-2 bg-transparent text-sm dark:text-gray-200 placeholder:text-gray-400 focus:outline-none resize-y block"
        />
      )}
    </div>
  );
}
