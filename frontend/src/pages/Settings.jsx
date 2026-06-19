import { Cog6ToothIcon } from '@heroicons/react/24/outline';

export default function Settings() {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Cog6ToothIcon className="w-6 h-6 text-gray-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">设置</h1>
      </div>

      {/* 占位：功能待完善 */}
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-3xl">⚙️</div>
        <p className="text-gray-600 dark:text-gray-400">设置功能正在建设中，敬请期待</p>
      </div>
    </div>
  );
}
