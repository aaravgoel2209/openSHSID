import { useNavigate } from 'react-router-dom';

// 工具箱：小工具集合。后续新增工具往这个数组里加即可。
const TOOLS = [
  {
    to: '/toolbox/ocr',
    icon: 'bi-file-earmark-text',
    title: 'OCR 扫描',
    desc: '上传 PDF / 图片，识别文字并勾选保留，交给 AI 摘要。',
    accent: 'from-indigo-500 to-purple-600',
  },
];

export default function Toolbox() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <i className="bi bi-tools text-indigo-500" /> 工具箱
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">一些实用的小工具</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <button
            key={tool.to}
            onClick={() => navigate(tool.to)}
            className="text-left bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tool.accent} flex items-center justify-center text-white text-xl mb-3`}>
              <i className={`bi ${tool.icon}`} />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{tool.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{tool.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
