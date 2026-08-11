# 04 — 后端：API 接口参考

> 相关文档：[目录](index.md) · [概述](01-overview.md) · [快速开始](02-quickstart.md) · [后端](03-backend.md) · [前端](05-frontend.md) · [模型服务](06-model-service.md) · [部署](07-deployment.md) · [开发规范](08-development.md)

所有端点位于 `/api/` 下。除非特别说明，GET 公开、写操作需登录。认证头：`Authorization: Token <key>`。

## 1. 认证 —— `/api/auth/`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `register/` | 公开 | `{username, password}` → `{token, user}`（201） |
| POST | `login/` | 公开 | → `{token, user}` |
| GET | `profile/` | 登录 | 当前用户 |
| GET | `users/<id>/` | 公开 | 他人公开画像 |
| GET | `notices/` | 公开 | 公告列表；POST 需 staff |
| DELETE | `notices/<id>/` | staff | |
| GET | `weekly-top/` | 公开 | 近 7 天热度前 5 用户 |
| POST | `avatar/upload/` | 登录 | multipart，JPG/PNG/GIF/WebP，≤ 5 MB |
| GET | `ai-session/` | 登录 | AI 对话会话令牌 |
| GET | `admin/dashboard/` | staff | 平台统计 + 时间序列 |
| GET | `admin/users/` | staff | 用户列表 |
| GET/PATCH/DELETE | `admin/users/<id>/` | staff | 用户管理 |
| GET | `admin/content/` | staff | 内容列表（`?type=`） |
| DELETE | `admin/content/<kind>/<id>/` | staff | 删除内容 |

## 2. 问答 —— `/api/qa/`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `labels/` | 标签列表 |
| GET/POST | `questions/` | 列表（`?search=`；登录用户个性化排序）/ 创建（违禁词过滤 + 异步翻译；`labels: []`） |
| GET | `questions/<id>/` | 详情（含回答） |
| POST | `questions/<id>/view/` | 浏览数 +1 |
| POST | `questions/<id>/like/` | 点赞切换（登录） |
| GET/POST | `questions/<id>/answers/` | 列表 / 创建。回复中含 `@Rei` → 流式 AI 回复 |
| DELETE | `questions/<id>/answers/` | 删除（staff） |
| POST | `answers/<id>/like/` | 点赞切换（登录） |

## 3. 知识库 —— `/api/knowledge/`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `grades/` / `subjects/` | 筛选维度 |
| GET/POST | `articles/` | 列表（`?grade=&subject=&label=&search=`）/ 创建（过滤 + 翻译） |
| GET | `search-titles/` | 标题联想（`?q=&limit=`） |
| GET/DELETE | `articles/<id>/` | 详情 / 删除（staff） |
| POST | `articles/<id>/view/` | 浏览数 +1 |
| POST | `articles/<id>/like/` | 点赞切换（登录） |
| GET/POST/DELETE | `articles/<id>/comments/` | 嵌套评论 |
| POST | `comments/<id>/like/` | 点赞切换（登录） |
| GET | `memory/` | staff：Rei 记忆条目（直接读模型服务的本地库） |
| POST | `ocr-import/` | staff：OCR 导入占位接口 |
| POST | `ocr-scan/` | 登录：上传 → OCR → Markdown |
| POST | `ocr-scan-stream/` | 登录：NDJSON 流式 OCR（大 PDF 用） |
| POST | `ocr-summarize/` | 登录：对 OCR 文本做 LLM 总结 |
| POST | `ocr-save/` | 登录：将 OCR 结果存为知识库文章 |

## 4. 私信 —— `/api/chat/`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `conversations/` | 登录：会话列表（含未读计数） |
| POST | `conversations/<user_id>/read/` | 标记会话已读 |
| GET/POST | `messages/` | 登录：列表（`?user=`）/ 发送 |
| GET | `users/` | 登录：用户搜索（`?q=`） |

## 5. 通知 —— `/api/notifications/`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `` | 最近 100 条通知 |
| GET | `unread-count/` | 未读数 |
| POST | `read-all/` | 全部已读 |
| POST | `<id>/read/` | 单条已读 |
| DELETE | `clear/` | 清空 |

## 6. 爬虫 —— `/api/crawler/`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST/DELETE | `credentials/` | 个人 LC 凭据（密码永不下发） |
| POST | `sync/` | staff：爬取 LinkedClassroom 并同步课程 |
| GET | `courses/` | 已同步课程列表 |
| GET | `courses/<course_id>/` | 课程详情（含章节与活动） |
| GET | `image-proxy/` | 通过已认证会话代理 LC 图片 |
| GET | `download/` | 代理下载 LC 资源 |
| GET | `browser-login/` | 自动提交 LC 登录的 HTML 页（安装会话 Cookie） |
| POST | `clear-cache/` | staff：清空 LC 会话缓存 |

## 7. 贴吧 —— `/api/postbar/`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `subbars/` | 列表（`?search=`）/ 创建 |
| GET | `subbars/<id>/` | 详情 |
| GET/POST/DELETE | `subbars/<id>/managers/` | 吧务列表 / 添加 / 移除（仅吧主） |
| GET/POST | `subbars/<id>/posts/` | 吧内帖子 |
| GET/DELETE | `posts/<id>/` | 详情 / 删除（吧务） |
| POST | `posts/<id>/view/` | 浏览数 +1 |
| POST | `posts/<id>/like/` | 点赞切换（登录） |
| GET/POST/DELETE | `posts/<id>/comments/` | 嵌套评论 |
| POST | `comments/<id>/like/` | 点赞切换（登录） |

## 8. 根路由总览

```
OpenSHSID_backend/urls.py
├── admin/                              (Django 后台)
├── api/qa/         → qa.urls           (8 条路由)
├── api/knowledge/  → knowledge.urls    (14 条路由，含 OCR + memory)
├── api/auth/       → accounts.urls     (13 条路由，含管理后台)
├── api/chat/       → chat.urls         (4 条路由)
├── api/notifications/ → notifications.urls (5 条路由)
├── api/crawler/    → crawler.urls      (8 条路由)
├── api/postbar/    → postbar.urls      (9 条路由)
└── /media/...                          (开发环境 static())
```

---

**下一篇**：[05 — 前端：React 单页应用](05-frontend.md)
