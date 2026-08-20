// frontend/src/mt/worker.js
//
// 【已退役】浏览器端 OPUS-MT 推理 Worker（transformers.js + onnxruntime-web）。
// 翻译已改为服务端完成：前端 POST Flask 模型服务 /translate（见 engine.js），
// 不再创建 Web Worker、不再从 ModelScope 下载模型权重，main 线程无任何消息协议。
//
// 本文件仅保留文件名以维持目录结构稳定（避免遗留引用 404）；
// 新代码不应 import 本模块。若要恢复浏览器端推理，参考 git 历史中的旧实现。
