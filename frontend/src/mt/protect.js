// frontend/src/mt/protect.js
//
// 【已退役】浏览器端翻译前的文本保护（PUA 占位符）、分段与源语言探测。
// 服务端架构下这些工作都在 Flask 侧完成：
//   - 数学公式 / 代码保护：model/app.py 的 _protect_math / _restore_math
//     （同为 PUA 占位符方案，译后还原，MathJax 正常渲染）；
//   - 分段：服务端 LLM 上下文窗口足够大，前端整文直发，无需切块；
//   - 源语言探测：请求始终带 target，由服务端按原文自动识别。
//
// 本文件仅保留文件名以维持目录结构稳定；新代码不应 import 本模块。
// 旧实现（protect/segment/restore/detectSourceLang）见 git 历史。
