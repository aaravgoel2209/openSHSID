import { useContext, useRef, useState, useCallback } from 'react';
import { Cog6ToothIcon, CameraIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../context/AuthContext';
import { uploadAvatar } from '../api/auth';
import { resolveAvatar } from '../utils/avatar';
import { useUI } from '../context/UIContext';
import { useLang } from '../context/LanguageContext';
import { getServerOverride, setServerOverride, DJANGO_ORIGIN } from '../config';
import { getPrefs, updatePrefs, ACCENT_PRESETS, DEFAULT_ACCENT } from '../config/prefs';
import GlassPanel from '../components/GlassPanel';

const LEVELS = [
  { key: 'simple', label: '兼容', desc: '兼容模式，纯色卡片，性能最优。' },
  { key: 'normal', label: '普通', desc: '默认界面，轻微玻璃效果，兼顾性能与视觉。' },
  { key: 'complex', label: '复杂', desc: '启用液态玻璃特效，卡片呈现流动质感。' },
  { key: 'extreme', label: '极致', desc: '最强液态玻璃 + 全站卡片玻璃化，视觉拉满。' },
];

const AVATAR_COLORS = ['blue','green','red','purple','orange','indigo','emerald','sky','rose'];
function getAvatarColor(username) {
  const hash = Math.abs((username || '').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
  return AVATAR_COLORS[hash % 9];
}

// Center-crop then resize to size×size, export as JPEG at the given quality.
function compressAvatar(file, size = 128, quality = 0.88) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Square center-crop: take the largest centered square from the source
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - s) / 2;
      const sy = (img.naturalHeight - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      canvas.toBlob(
        (blob) => resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' })),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = reject;
    img.src = blobUrl;
  });
}

export default function Settings() {
  const { complexity, setComplexity } = useUI();
  const { user, refreshUser } = useContext(AuthContext);
  const { t } = useLang();

  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text }

  // 后端地址（运行时覆盖，存 localStorage；保存后需刷新页面生效）
  const [serverInput, setServerInput] = useState(getServerOverride());
  const [serverMsg, setServerMsg] = useState(null); // { type: 'ok'|'err', text }
  const currentServer = getServerOverride() || DJANGO_ORIGIN || '同源（当前域名）';

  // 个性化主题色（null = 默认靛蓝）
  const [accent, setAccentState] = useState(() => getPrefs().accent || null);
  const isDefaultAccent = !accent;
  const activeAccent = accent || DEFAULT_ACCENT;

  function setAccent(value) {
    setAccentState(value);
    updatePrefs({ accent: value });
  }

  // 实验功能：浏览器端机器翻译（OPUS-MT）尝鲜开关，默认关闭
  const [mtExperimental, setMtExperimental] = useState(() => getPrefs().mt_experimental === true);
  const [mtMsg, setMtMsg] = useState(null); // { type: 'ok'|'err', text }

  function handleToggleMt() {
    const next = !mtExperimental;
    setMtExperimental(next);
    updatePrefs({ mt_experimental: next });
    setMtMsg({ type: 'ok', text: next ? '已开启，详情页将显示翻译工具条' : '已关闭' });
  }

  function handleSaveServer() {
    try {
      setServerOverride(serverInput);
      // 配置在模块加载时读取，必须整页刷新才能让新地址生效
      window.location.reload();
    } catch {
      setServerMsg({ type: 'err', text: '地址格式无效，例如 https://openshsid.zengyuxiang.cn' });
    }
  }

  function handleResetServer() {
    setServerOverride('');
    window.location.reload();
  }

  const currentAvatar = resolveAvatar(user?.avatar);
  const fallbackSrc = user ? `/images/${getAvatarColor(user.username)}.jpg` : null;

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setMsg(null);
    try {
      const compressed = await compressAvatar(file); // → 128×128 JPEG
      if (preview) URL.revokeObjectURL(preview);
      const newPreview = URL.createObjectURL(compressed);
      setSelectedFile(compressed);
      setPreview(newPreview);
    } catch {
      setMsg({ type: 'err', text: '图片处理失败，请重试' });
    } finally {
      setCompressing(false);
    }
  }, [preview]);

  function handleCancel() {
    setSelectedFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setMsg(null);
    fileRef.current.value = '';
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setMsg(null);
    try {
      await uploadAvatar(selectedFile);
      await refreshUser();
      setMsg({ type: 'ok', text: '头像已更新' });
      handleCancel();
    } catch (err) {
      const text = err.response?.data?.error || '上传失败，请重试';
      setMsg({ type: 'err', text });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Cog6ToothIcon className="w-6 h-6 text-gray-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">设置</h1>
      </div>

      {/* ── Avatar section ── */}
      {user && (
        <GlassPanel
          plainClass="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 mb-4"
          glassContentClass="p-6 mb-4"
          cornerRadius={20}
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">头像</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">支持 JPG、PNG、GIF、WebP，最大 5 MB。</p>

          <div className="flex items-center gap-5">
            {/* Avatar preview */}
            <div className="relative shrink-0">
              <img
                src={preview || currentAvatar || fallbackSrc}
                alt="avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                onError={(e) => { e.currentTarget.src = fallbackSrc; }}
              />
              {/* camera overlay */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                title="选择图片"
              >
                <CameraIcon className="w-7 h-7 text-white" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {compressing ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">处理中…</p>
              ) : !selectedFile ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  选择图片
                </button>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-gray-400 dark:text-gray-500">已压缩至 128×128 JPEG</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={uploading}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium text-white transition-colors"
                    >
                      {uploading ? '上传中…' : '确认上传'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={uploading}
                      className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {msg && (
                <p className={`text-sm ${msg.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {msg.text}
                </p>
              )}
            </div>
          </div>

          {/* hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </GlassPanel>
      )}

      {/* ── UI complexity section ── */}
      <GlassPanel
        plainClass="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6"
        glassContentClass="p-6"
        cornerRadius={20}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">界面复杂度</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">选择界面的信息密度与特效丰富程度。</p>

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

      {/* ── Theme color section ── */}
      <GlassPanel
        plainClass="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 mt-4"
        glassContentClass="p-6 mt-4"
        cornerRadius={20}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">主题色</h2>
          {!isDefaultAccent && (
            <button
              type="button"
              onClick={() => setAccent(null)}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:opacity-70 transition-opacity"
            >
              恢复默认
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">选择全站的主色调，按钮、链接、导航高亮会同步更换。</p>

        {/* 预设色板 */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {ACCENT_PRESETS.map((p) => {
            const active = (p.value || null) === accent;
            return (
              <button
                key={p.name}
                type="button"
                title={p.name}
                onClick={() => setAccent(p.value)}
                className="flex flex-col items-center gap-1.5 group"
              >
                <span
                  className={`w-9 h-9 rounded-full transition-all ${
                    active ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105' : 'group-hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: p.value || DEFAULT_ACCENT,
                    ...(active ? { boxShadow: `0 0 0 2px ${p.value || DEFAULT_ACCENT}` } : {}),
                  }}
                />
                <span className={`text-[11px] ${active ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400'}`}>
                  {p.name.replace('（默认）', '')}
                </span>
              </button>
            );
          })}

          {/* 自定义取色 */}
          <label className="flex flex-col items-center gap-1.5 cursor-pointer group" title="自定义颜色">
            <span className="relative w-9 h-9 rounded-full border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <span
                className="absolute inset-1 rounded-full"
                style={{ background: `conic-gradient(#f43f5e, #f59e0b, #10b981, #06b6d4, #8b5cf6, #f43f5e)` }}
              />
              <span
                className="absolute inset-1 rounded-full border border-white/60"
                style={{ backgroundColor: !isDefaultAccent && !ACCENT_PRESETS.some((p) => p.value === accent) ? accent : 'transparent' }}
              />
            </span>
            <span className="text-[11px] text-gray-400">自定义</span>
            <input
              type="color"
              value={accent || DEFAULT_ACCENT}
              onChange={(e) => setAccent(e.target.value)}
              className="absolute w-0 h-0 opacity-0"
            />
          </label>
        </div>

        {/* 当前效果预览 */}
        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800/60">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
            style={{ backgroundColor: activeAccent }}
          >
            示例按钮
          </button>
          <span className="text-sm" style={{ color: activeAccent }}>主题色文字链接</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: `${activeAccent}22`, color: activeAccent }}
          >
            标签
          </span>
          <span className="text-xs text-gray-400 ml-auto font-mono">{isDefaultAccent ? '默认（靛蓝）' : activeAccent.toUpperCase()}</span>
        </div>
      </GlassPanel>

      {/* ── Backend server section ── */}
      <GlassPanel
        plainClass="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 mt-4"
        glassContentClass="p-6 mt-4"
        cornerRadius={20}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">后端地址</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
          页面连接的后端服务器地址。留空使用默认值，保存后自动刷新生效。
        </p>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          当前生效：<span className="font-mono text-[13px] text-indigo-600 dark:text-indigo-400 break-all">{currentServer}</span>
          {getServerOverride() && (
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">自定义</span>
          )}
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={serverInput}
            onChange={(e) => { setServerInput(e.target.value); setServerMsg(null); }}
            placeholder={DJANGO_ORIGIN || 'https://example.com（留空 = 默认）'}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm font-mono text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
          />
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveServer}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white transition-colors"
            >
              保存并刷新
            </button>
            {getServerOverride() && (
              <button
                type="button"
                onClick={handleResetServer}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                恢复默认
              </button>
            )}
          </div>
        </div>

        {serverMsg && (
          <p className={`text-sm mt-3 ${serverMsg.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
            {serverMsg.text}
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          注意：跨域连接需要目标后端在 CORS 中放行本站域名，否则请求会被浏览器拦截。
        </p>
      </GlassPanel>

      {/* ── Experimental features section ── */}
      <GlassPanel
        plainClass="bg-white dark:bg-slate-900/50 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 mt-4"
        glassContentClass="p-6 mt-4"
        cornerRadius={20}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('settings.experimental')}</h2>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.mtExperimental')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('settings.mtExperimentalDesc')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={mtExperimental}
            onClick={handleToggleMt}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              mtExperimental ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                mtExperimental ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {mtMsg && (
          <p className={`text-sm mt-3 ${mtMsg.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
            {mtMsg.text}
          </p>
        )}
      </GlassPanel>
    </div>
  );
}
