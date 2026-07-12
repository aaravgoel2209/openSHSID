import { useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import {
  ArrowLeftIcon, DocumentArrowUpIcon, SparklesIcon, ClipboardIcon,
  BookmarkIcon, CheckIcon,
} from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { ocrScan, summarizeText, saveToKnowledge } from '../api/toolbox';
import MarkdownView from '../components/MarkdownView';
import { copyText as copyToClipboard } from '../utils/clipboard';

const TYPE_LABEL = {
  title: '标题', text: '正文', table: '表格', formula: '公式',
  figure: '图注', caption: '图注', list: '列表', image: '图片',
};

// bbox 为 0-999 归一化坐标 → 百分比
const pct = (v) => `${v / 9.99}%`;

export default function OcrScan() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [pages, setPages] = useState(null);
  const [regions, setRegions] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState('');
  const [showList, setShowList] = useState(false);

  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState('');
  const [copied, setCopied] = useState(false);
  const [textCopied, setTextCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [title, setTitle] = useState('');

  const reset = () => {
    setPages(null); setRegions([]); setSelected(new Set());
    setSummary(''); setSaved(null); setError('');
  };

  const handleFile = async (f) => {
    if (!f) return;
    reset();
    setFile(f);
    setTitle((f.name || '').replace(/\.[^.]+$/, '')); // 用文件名作为默认标题
    setScanning(true);
    try {
      const data = await ocrScan(f);
      setPages(data.pages || []);
      setRegions(data.regions || []);
      setSelected(new Set((data.regions || []).map((r) => r.id))); // 默认全选
    } catch (e) {
      setError(e.response?.data?.error || 'OCR 识别失败');
    } finally {
      setScanning(false);
    }
  };

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const allSelected = regions.length > 0 && selected.size === regions.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(regions.map((r) => r.id)));

  const selectedText = () =>
    regions.filter((r) => selected.has(r.id)).map((r) => r.text).join('\n\n');

  const handleSummarize = async () => {
    const text = selectedText();
    if (!text) return;
    setSummarizing(true); setSummary(''); setError('');
    try {
      setSummary((await summarizeText(text)) || '（模型未返回摘要）');
    } catch (e) {
      setError(e.response?.data?.error || '摘要失败，请检查主聊天模型是否在线');
    } finally {
      setSummarizing(false);
    }
  };

  const handleSave = async () => {
    const text = selectedText();
    if (!text) return;
    setSaving(true); setSaved(null); setError('');
    try {
      const finalTitle = title.trim() || (file?.name || 'OCR 导入').replace(/\.[^.]+$/, '');
      setSaved(await saveToKnowledge(text, finalTitle));
    } catch (e) {
      setError(e.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const copySummary = async () => {
    if (await copyToClipboard(summary)) {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } else {
      setError('复制失败，请手动选择文本复制');
    }
  };

  const copyText = async () => {
    const text = selectedText();
    if (!text) return;
    if (await copyToClipboard(text)) {
      setTextCopied(true); setTimeout(() => setTextCopied(false), 1500);
    } else {
      setError('复制失败，请手动选择文本复制');
    }
  };

  if (!user) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-yellow-700 dark:text-yellow-300">
        请先登录后使用 OCR 扫描。
      </div>
    );
  }

  const regionsByPage = (pageIndex) => regions.filter((r) => r.page === pageIndex && r.bbox?.length >= 4);

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate('/toolbox')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" /> 返回工具箱
      </button>

      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
        <i className="bi bi-file-earmark-text text-indigo-500" /> OCR 扫描
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        上传 PDF / 图片 → 识别文字并在原文上画框 → 勾选保留 → 交给 AI 摘要或存入知识库。
      </p>

      <input
        ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
      />
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
        className="cursor-pointer border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors mb-5"
      >
        <DocumentArrowUpIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {file ? file.name : '点击或拖拽文件到此处上传（PDF / 图片）'}
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 text-sm rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {scanning && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <Spinner size="lg" />
          <p className="text-sm">正在识别文字…（多页 PDF 可能较慢）</p>
        </div>
      )}

      {pages && !scanning && (
        <>
          {/* 操作条 */}
          <div className="sticky top-2 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-gray-200/80 dark:border-slate-800/80 rounded-xl px-4 py-2.5 mb-4 shadow-sm space-y-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-indigo-500" />
                已选 {selected.size}/{regions.length}
              </label>
              <button onClick={() => setShowList((v) => !v)} className="text-xs text-gray-500 hover:text-indigo-500 transition-colors">
                {showList ? '隐藏文本列表' : '查看文本列表'}
              </button>
              <div className="flex-1" />
              <Button size="sm" variant="flat" onPress={copyText} isDisabled={selected.size === 0}
                startContent={textCopied ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}>
                {textCopied ? '已复制' : '复制文本'}
              </Button>
              <Button size="sm" color="primary" variant="flat" onPress={handleSummarize}
                isLoading={summarizing} isDisabled={summarizing || selected.size === 0}
                startContent={!summarizing && <SparklesIcon className="w-4 h-4" />}>
                生成摘要
              </Button>
              <Button size="sm" color="primary" onPress={handleSave}
                isLoading={saving} isDisabled={saving || selected.size === 0}
                startContent={!saving && <BookmarkIcon className="w-4 h-4" />}>
                存入知识库
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">标题</span>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="存入知识库时的文章标题"
                className="flex-1 min-w-0 text-sm rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
              />
            </div>
          </div>

          {/* 摘要输出（紧跟操作条下方） */}
          {(summarizing || summary) && (
            <div className="mb-4 bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <SparklesIcon className="w-4 h-4 text-indigo-500" /> AI 摘要
                </h3>
                {summary && (
                  <button onClick={copySummary} className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-500 transition-colors">
                    <ClipboardIcon className="w-3.5 h-3.5" />{copied ? '已复制' : '复制'}
                  </button>
                )}
              </div>
              {summarizing && !summary ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm"><Spinner size="sm" /> 正在总结…</div>
              ) : (
                <MarkdownView className="md-body text-gray-700 dark:text-gray-300" markdown={summary} />
              )}
            </div>
          )}

          {saved && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg p-3 mb-4 flex items-center gap-2">
              <CheckIcon className="w-4 h-4" /> 已存入知识库：
              <button onClick={() => navigate(`/knowledge/${saved.article_id}`)} className="font-medium underline">
                {saved.title}
              </button>
            </div>
          )}

          {regions.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">未识别到可勾选的文字区域</p>
          )}

          {/* 页面预览 + 版面框 */}
          <div className="space-y-6">
            {pages.map((pg) => (
              <div key={pg.index}>
                <div className="text-xs text-gray-400 mb-1">第 {pg.index + 1} 页</div>
                <div className="relative inline-block w-full border border-gray-200/80 dark:border-slate-800/80 rounded-lg overflow-hidden bg-white">
                  <img src={pg.image} alt={`第 ${pg.index + 1} 页`} className="block w-full select-none" />
                  {regionsByPage(pg.index).map((r) => {
                    const on = selected.has(r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() => toggle(r.id)}
                        title={r.text}
                        style={{ left: pct(r.bbox[0]), top: pct(r.bbox[1]), width: pct(r.bbox[2] - r.bbox[0]), height: pct(r.bbox[3] - r.bbox[1]) }}
                        className={`absolute group border-2 rounded-sm transition-colors ${
                          on
                            ? 'border-indigo-500 bg-indigo-500/15'
                            : 'border-gray-400/60 border-dashed bg-transparent hover:border-indigo-400 hover:bg-indigo-400/10'
                        }`}
                      >
                        {/* 角标：勾选标记 */}
                        <span className={`absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full flex items-center justify-center border shadow-sm ${
                          on ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-transparent'
                        }`}>
                          <CheckIcon className="w-3 h-3" strokeWidth={3} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 可选：文本列表（与勾选同步） */}
          {showList && (
            <div className="mt-5 space-y-2">
              {regions.map((r) => (
                <label
                  key={r.id}
                  className={`flex gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selected.has(r.id)
                      ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20'
                      : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                  }`}
                >
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)}
                    className="w-4 h-4 mt-0.5 accent-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded font-medium mb-1 bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400">
                      P{r.page + 1} · {TYPE_LABEL[r.type] || r.type}
                    </span>
                    <MarkdownView className="text-sm text-gray-700 dark:text-gray-300 break-words" markdown={r.text} />
                  </div>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
