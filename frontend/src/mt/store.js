// frontend/src/mt/store.js
//
// 【已退役】浏览器端 IndexedDB + LRU 译文缓存。
// 已决定不做前端缓存：翻译改为 POST /translate 后由服务端 LLM 现译现返，
// 浏览器侧不再保存任何译文（每次点击都是一次新请求）。
//
// 本文件仅保留文件名以维持目录结构稳定；新代码不应 import 本模块。
// 旧实现（makeCacheKey/getCached/setCached）见 git 历史。
