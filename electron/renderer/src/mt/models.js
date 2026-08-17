// frontend/src/mt/models.js
//
// 浏览器端机器翻译（MT）的模型注册表与翻译链解析器。
//
// 这是一个纯数据模块 —— 不 import 任何 npm 包。它对外暴露：
//   - MT_TARGETS    ：UI 暴露给用户的翻译目标语言（当前仅 ja；ko 已禁用，见下）。
//   - MT_MODELS     ：本仓库接入的 Xenova/opus-mt 模型子集（3 个，非全部 58 个）。
//   - resolveChain()：给定 (srcLang, target) 返回翻译跳转序列，或 null。
//
// Hop 描述符格式（由 todo 4 的 engine worker 解析消费）：
//   '<modelKey>'          —— 单跳，使用 MT_MODELS[<modelKey>]，无需前缀。
//   '<modelKey>:<prefix>' —— 单跳，使用 MT_MODELS[<modelKey>]，但需把
//                           <prefix>（如 '>>kor<<'）拼接到输入串前以指定
//                           输出语言。这是 OPUS-MT 多方言模型的语言标签约定。
//   解析时按【第一个】冒号切分：左半为 modelKey，右半为待拼接的前缀字面量。
//   （OPUS-MT 的前缀形如 >>xx<<，不含冒号，故首冒号切分安全。）
//
// 链是按顺序从左到右执行的 hop 列表：hop N 的输出即 hop N+1 的输入。
//
// approxMB 字段为估算下载体量，仅用于 UI 提示（如"该模型约 33MB"），
// 实际大小随 revision / 量化方式变化 —— 切勿用于带宽精确计算。

/**
 * UI 暴露给用户的翻译目标语言。
 *
 * - labelKey：对应 i18n 文案键（由 todo 6 的 MtTranslateBar 读取）。
 * - relayed：true 表示该目标经由英语中转（pivot），UI 可据此提示
 *   用户"可能略逊于直译"。ko 走 en-mul 多方言模型，属中转路径。
 *
 * NOTE (Task 11 G2, 2026-08-17): `ko` has been DISABLED — the G2 quality
 * gate found that Xenova/opus-mt-en-mul does NOT support the `>>kor<<`
 * language prefix (it is not in the model's supported target-language list;
 * the model emits "Unsupported language code" warning and produces mixed
 * English/French output instead of Korean). There is currently no
 * Korean-capable model in MT_MODELS, so ko is hidden from the UI target
 * picker. The i18n key `mt.target.ko` is left in place (harmless if
 * unused). The resolveChain 'en:ko'/'zh:ko' paths are left in place as
 * dead code (the UI never offers ko, so they are never called); do NOT
 * re-enable ko without first adding a Korean-capable model to MT_MODELS
 * and updating resolveChain. See .omo/evidence/task-11-browser-mt-nonmajor-g2.txt.
 */
export const MT_TARGETS = {
  ja: { labelKey: 'mt.target.ja' },
  // ko: { labelKey: 'mt.target.ko', relayed: true }, // ko disabled: G2 quality gate failed — en-mul >>kor<< produced inadequate output (not Korean; en-mul lacks Korean support)
};

/**
 * 已接入的模型子集。完整 OPUS-MT 经 Xenova 转出的 ONNX 列表约 58 个方向；
 * 这里只装当前需要的 3 个。
 *
 * 扩展方法：在 https://huggingface.co/Xenova 找到目标方向（如
 * Xenova/opus-mt-en-de），在此追加一个键值对：
 *   'en-de': { id: 'Xenova/opus-mt-en-de', revision: 'master', approxMB: 30 },
 * 然后在下方 resolveChain 的方向表里增加使用它的路径。
 *
 * 字段说明：
 *   - id           ：HuggingFace repo id（pipeline 的 model 参数）。
 *   - revision     ：模型分支/版本，用 'master' 取最新已转出的 ONNX。
 *   - approxMB     ：估算下载体量（MB），仅用于 UI 提示，非精确值。
 *   - targetPrefix ：仅多方言模型需要：{ <targetLang>: '<prefix>' }，
 *                    把目标语言前缀（如 '>>kor<<'）拼到输入串前以指定输出
 *                    语言。单方言模型省略此字段。
 */
export const MT_MODELS = {
  'zh-en': { id: 'Xenova/opus-mt-zh-en', revision: 'master', approxMB: 35 },
  // DEPRECATED (Task 11 G2 fix, 2026-08-17): `Xenova/opus-mt-en-jap` produces
  // grammatical but SEMANTICALLY-WRONG Japanese in transformers.js v3.8.1
  // (e.g. "Shanghai High School..." -> "いと高き者の箴言..." = "maxim of the
  // very high one"; see .omo/evidence/task-11-browser-mt-nonmajor-g2.txt).
  // ja now goes through en-mul with the >>jpn<< prefix (verified coherent).
  // Kept here as dead data (resolveChain no longer references it) so the
  // file's "3 models" comment above stays accurate and future re-evaluation
  // has a starting point. Safe to remove if en-jap is confirmed permanently
  // broken across revisions / transformers versions.
  'en-jap': { id: 'Xenova/opus-mt-en-jap', revision: 'master', approxMB: 33 },
  'en-mul': {
    id: 'Xenova/opus-mt-en-mul',
    revision: 'master',
    approxMB: 80,
    // 多方言模型：每个目标语言用 >>xx<< 前缀指定输出。ko 已禁用（G2 失败，
    // en-mul 不支持 >>kor<<），但前缀字面量保留作为元数据；ja 用 >>jpn<<
    // （G2 验证通过，替代了 en-jap 的错误输出）。
    targetPrefix: { ko: '>>kor<<', jpn: '>>jpn<<' },
  },
};

/**
 * resolveChain(srcLang, target) —— 返回 srcLang → target 的翻译跳转序列。
 *
 * 返回值：
 *   - string[]：每个元素是一个 hop 描述符（见文件头格式说明）。
 *   - null    ：该语言对当前不支持，或输入非法。
 *
 * 当前支持的路径：
 *   en → ja : ['en-mul:>>jpn<<']        （en-mul 多方言，jpn 前缀选日语；
 *                                        G2 验证为替代 en-jap 的方案）
 *   en → ko : ['en-mul:>>kor<<']        （en-mul 多方言，kor 前缀选韩语；
 *                                        UI 已禁用 ko，此路径为死代码）
 *   zh → ja : ['zh-en', 'en-mul:>>jpn<<']  （先中→英，再英→日）
 *   zh → ko : ['zh-en', 'en-mul:>>kor<<']  （UI 已禁用 ko，死代码）
 *
 * 注意：下表中的前缀字面量必须与 MT_MODELS['en-mul'].targetPrefix 的对应
 * 条目保持一致；若修改了 targetPrefix，请同步修改下表（当前为人工同步）。
 * 当前两处：'>>jpn<<' 与 targetPrefix.jpn，'>>kor<<' 与 targetPrefix.ko。
 *
 * 非法输入（null / undefined / ''）一律返回 null，绝不抛异常。
 *
 * @param {string} srcLang - 源语言码，如 'en'、'zh'。
 * @param {string} target  - 目标语言码，如 'ja'、'ko'。
 * @returns {string[]|null} hop 描述符数组，或 null。
 */
export function resolveChain(srcLang, target) {
  if (!srcLang || !target) return null;
  const chains = {
    'en:ja': ['en-mul:>>jpn<<'],
    'en:ko': ['en-mul:>>kor<<'],
    'zh:ja': ['zh-en', 'en-mul:>>jpn<<'],
    'zh:ko': ['zh-en', 'en-mul:>>kor<<'],
  };
  return chains[`${srcLang}:${target}`] || null;
}
