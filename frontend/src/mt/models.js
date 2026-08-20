// frontend/src/mt/models.js
//
// 翻译 UI 的目标语言注册表（纯数据模块，无 import）。
//
// 翻译本身在服务端完成（POST /translate，模型由 config.json 的 llm.model_name
// 指定）——前端不再维护可下载模型清单（旧 MT_MODELS / resolveChain 已随
// OPUS-MT Worker 一起退役）。
//
// MT_TARGETS 决定 MtTranslateBar 下拉框展示哪些语言：
//   - labelKey：对应 i18n 文案键。
// 服务端 /translate 接受任意语言代码 / 名称，要新增下拉项时在此追加即可
// （i18n 需同步加 mt.target.<code> 键，中英两块都加）。
//
// ko 仍默认不展示（历史遗留：浏览器端 en-mul 模型不支持韩语）。服务端 LLM
// 其实能译韩语 —— 如需启用，取消下行注释并恢复 i18n 键 mt.target.ko 即可。

export const MT_TARGETS = {
  ja: { labelKey: 'mt.target.ja' },
  // ko: { labelKey: 'mt.target.ko' }, // 服务端已支持；默认不展示，需要时取消注释
};
