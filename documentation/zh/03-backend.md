# 03 — 后端：Django

> 相关文档：[目录](index.md) · [概述](01-overview.md) · [快速开始](02-quickstart.md) · [API](04-backend-api.md) · [前端](05-frontend.md) · [模型服务](06-model-service.md) · [部署](07-deployment.md) · [开发规范](08-development.md)
>
> 完整端点参考见 **[04-backend-api.md](04-backend-api.md)**。

## 1. 应用（App）

| App | 路径 | 用途 |
|---|---|---|
| `accounts` | `accounts/` | 注册/登录（token）、带 32 维向量与头像的用户画像、公告、周榜用户、staff 管理后台、AI 会话令牌签发 |
| `qa` | `qa/` | 问答：Question、Answer（嵌套）、Label、点赞、浏览、向量、热度排序；`@Rei` 流式回复 |
| `knowledge` | `knowledge/` | 知识库：Grade、Subject、Article、Comment；OCR 导入流水线；内联个性化排序 |
| `chat` | `chat/` | 一对一私信、会话列表、未读计数 |
| `postbar` | `postbar/` | 类 Reddit 的 Subbar → Post → PostComment，吧务权限 |
| `crawler` | `crawler/` | LinkedClassroom（Moodle）爬虫：凭据、课程、章节、活动、代理 |
| `notifications` | `notifications/` | 由 Django signal 驱动的通知收件箱 |

## 2. 数据模型（摘要）

| 模型 | 关键字段 | 备注 |
|---|---|---|
| `accounts.UserProfile` | user（1:1）、embedding（JSON 32 维）、avatar | 注册时自动创建 |
| `accounts.Notice` | title、content、created_by | 站内公告 |
| `qa.Label` | name（唯一） | 与知识库文章共用 |
| `qa.Question` | title、content、author、views、likes（M2M）、labels（M2M）、embedding、source_lang、title/content_translated、created_at | `heat` 属性；自动翻译 |
| `qa.Answer` | question（FK）、content、parent（自引用 FK）、author、likes、is_streaming、created_at | 嵌套回复；`is_streaming` 标记 Rei 生成中的回答 |
| `knowledge.Grade` / `Subject` | name（唯一） | 文章筛选维度 |
| `knowledge.Article` | title、content、grade、subject、author、author_name、views、likes、labels、embedding、译文字段、created_at | `heat` 属性；自动翻译 |
| `knowledge.Comment` | article（FK）、content、parent（自引用 FK）、author、likes | 嵌套回复 |
| `chat.Message` | sender、recipient、content、is_read | 建有 (recipient, is_read) 索引 |
| `postbar.Subbar` | name（唯一）、description、created_by、managers（M2M） | `can_manage()` 权限辅助方法 |
| `postbar.Post` | subbar（FK）、title、content、author、views、likes | |
| `postbar.PostComment` | post（FK）、content、parent（自引用 FK）、author、likes | |
| `crawler.Credential` | user（1:1）、username、password | 个人 LC 登录凭据 |
| `crawler.Course` | course_id（唯一）、title、summary、last_synced | |
| `crawler.Section` | course（FK）、title、url、photo_url、tile_icon、order | |
| `crawler.Activity` | section（FK）、modtype、cmid、title、url、restricted | |
| `notifications.Notification` | recipient、actor、type（answer/reply/like/message/system）、title、message、link、is_read | |

## 3. 认证

- **主认证**：DRF Token 认证 —— 请求头 `Authorization: Token <key>`。登录/注册返回 token，前端存入 `localStorage`。
- **辅助认证**：Django Session 认证（保证 /admin 可用）。
- 全局默认权限为 `AllowAny`，各视图通过 `IsAuthenticated` / `IsAuthenticatedOrReadOnly` / `IsAdminUser` 覆盖。
- `UNAUTHENTICATED_USER = None` —— 未登录时 `request.user` 为 `None`（而非 `AnonymousUser`）。
- **AI 会话**：`GET /api/auth/ai-session/` 返回签名令牌（`chat-user-<id>`），Flask 服务通过共享的 `REI_SESSION_SECRET` 校验。

## 4. 后端横切行为

- **内容审核**：`OpenSHSID_backend/moderation.py` 拒绝包含 `BLOCKED_WORDS`（不区分大小写）的发布内容。
- **自动翻译**：Question/Article 创建时，后台线程调用 Flask `/translate`，缓存 `source_lang` / `title_translated` / `content_translated`。前端通过 `utils/lang.js` 按语言切换显示。
- **向量初始化**：`signals.py` 为新 Question/Article 填充 32 维随机向量（保证推荐排序立即可用），并在注册时自动创建 `UserProfile`。
- **数据库二选一（SQLite / MySQL）**：`config.json django.database.type` 决定，可用 `DB_TYPE` 环境变量覆盖（详见 02-quickstart 2.3 节）。SQLite 模式每个连接都会执行 `journal_mode=WAL`、`synchronous=NORMAL`、`busy_timeout=20000`（`signals.py` 按 `connection.vendor` 自动跳过 MySQL）—— 缓解流式写入下的锁竞争。MySQL 模式驱动为 PyMySQL（`OpenSHSID_backend/__init__.py` 注册），连接参数见 `django.database.mysql`，字符集 `utf8mb4`。
- **个性化排序**：`knowledge/ranking.py` 与 `qa/views.py:_rank_questions` 使用登录用户的向量对列表重排：`avg(max(item·heat − user, 0)) · 10`（算法模式），按用户缓存 5 秒。
- **@Rei 流式回复**：回答中含 `@Rei` 时，`qa/views.py:_generate_rei_reply` 先创建空回答（`is_streaming=True`），携带签名令牌 POST 到模型服务 `/rei/stream`，并将 SSE 输出按节流写入数据库，前端可看到回复「逐字打出来」。
- **通知**：`notifications/signals.py` 在新回答/回复、点赞（M2M 变更）、私信时触发通知。

## 5. 管理命令

| 命令 | 用途 |
|---|---|
| `python manage.py reset_db [--yes] [--no-migrate]` | 清空当前数据库（MySQL 删全部表 / SQLite 删文件）并重新 migrate —— 切换测试/部署环境前清数据 |
| `python manage.py migrate_sqlite_to_mysql [--reset] [--yes]` | 把本地 SQLite（db.sqlite3）数据迁移到当前 MySQL 库（dumpdata → loaddata → 重置自增） |
| `python manage.py retranslate [--force] [--only qa\|knowledge]` | 对缺失译文的 Question/Article 重新翻译 |
| `python manage.py crawl_linkedclassroom --username <u> --password <p> [--course-ids ...]` | 命令行同步 LinkedClassroom 课程 |

## 6. Django 后台

`/admin/` 可管理 7 个 app 的全部模型（内联编辑：Question+Answers、Course+Sections+Activities、Subbar 的 `filter_horizontal` 吧务等）。需要超管（`python manage.py createsuperuser`）。

---

**下一篇**：[04 — 后端：API 接口参考](04-backend-api.md)
