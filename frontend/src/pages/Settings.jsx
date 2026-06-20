import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useUI } from '../context/UIContext';
import GlassPanel from '../components/GlassPanel';

const LEVELS = [
  { key: 'simple', label: '兼容', desc: '兼容界面，仅保留核心功能。' },
  { key: 'normal', label: '普通', desc: '默认界面，特效均衡。' },
  { key: 'complex', label: '复杂', desc: '启用液态玻璃等更多特效。' },
  { key: 'extreme', label: '极致', desc: '最强液态玻璃特效，视觉拉满（性能要求更高）。' },
];

export default function Settings() {
  const { complexity, setComplexity } = useUI();

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Cog6ToothIcon className="w-6 h-6 text-gray-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">设置</h1>
      </div>

      <GlassPanel
        plainClass="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6"
        glassContentClass="p-6"
        cornerRadius={20}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">界面复杂度</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">选择界面的信息密度与特效丰富程度。</p>

        {/* 分段开关 */}
        <div className="inline-flex flex-wrap p-1 rounded-xl bg-gray-100 dark:bg-slate-800">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => setComplexity(l.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                complexity === l.key
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
          {LEVELS.find((l) => l.key === complexity)?.desc}
        </p>
        {(complexity === 'complex' || complexity === 'extreme') && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            液态玻璃特效在 Chromium 内核浏览器中效果最佳（Safari/Firefox 仅部分支持）。目前正在开发中
          </p>
        )}
      </GlassPanel>
    </div>
  );
}
