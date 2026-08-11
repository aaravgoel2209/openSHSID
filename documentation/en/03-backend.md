# 03 — Backend: Django

> Applies to: [Index](index.md) · [Overview](01-overview.md) · [Quick Start](02-quickstart.md) · [API](04-backend-api.md) · [Frontend](05-frontend.md) · [Model Service](06-model-service.md) · [Deployment](07-deployment.md) · [Development](08-development.md)
>
> The full endpoint reference lives in **[04-backend-api.md](04-backend-api.md)**.

## 1. Apps

| App | Path | Purpose |
|---|---|---|
| `accounts` | `accounts/` | Register/login (token), profile with 32-dim embedding + avatar, site notices, weekly top users, staff admin dashboard, AI session token issuance |
| `qa` | `qa/` | Q&A: Questions, Answers (nested), Labels, likes, views, embeddings, heat ranking; `@Rei` streaming replies |
| `knowledge` | `knowledge/` | Knowledge base: Grade, Subject, Article, Comment; OCR import pipeline; inline personalized ranking |
| `chat` | `chat/` | 1:1 direct messaging, conversations, unread counts |
| `postbar` | `postbar/` | Reddit-style Subbar → Post → PostComment, manager permissions |
| `crawler` | `crawler/` | LinkedClassroom (Moodle) scraper: credentials, courses, sections, activities, proxies |
| `notifications` | `notifications/` | Notification inbox driven by Django signals |

## 2. Data models (summary)

| Model | Key fields | Notes |
|---|---|---|
| `accounts.UserProfile` | user (1:1), embedding (JSON 32-dim), avatar | Auto-created on user signup |
| `accounts.Notice` | title, content, created_by | Site announcements |
| `qa.Label` | name (unique) | Shared with knowledge articles |
| `qa.Question` | title, content, author, views, likes (M2M), labels (M2M), embedding, source_lang, title/content_translated, created_at | `heat` property; auto-translated |
| `qa.Answer` | question (FK), content, parent (self FK), author, likes, is_streaming, created_at | Nested replies; `is_streaming` marks in-progress Rei answers |
| `knowledge.Grade` / `Subject` | name (unique) | Filters for articles |
| `knowledge.Article` | title, content, grade, subject, author, author_name, views, likes, labels, embedding, translations, created_at | `heat` property; auto-translated |
| `knowledge.Comment` | article (FK), content, parent (self FK), author, likes | Nested replies |
| `chat.Message` | sender, recipient, content, is_read | Indexed on (recipient, is_read) |
| `postbar.Subbar` | name (unique), description, created_by, managers (M2M) | `can_manage()` permission helper |
| `postbar.Post` | subbar (FK), title, content, author, views, likes | |
| `postbar.PostComment` | post (FK), content, parent (self FK), author, likes | |
| `crawler.Credential` | user (1:1), username, password | Per-user LC login |
| `crawler.Course` | course_id (unique), title, summary, last_synced | |
| `crawler.Section` | course (FK), title, url, photo_url, tile_icon, order | |
| `crawler.Activity` | section (FK), modtype, cmid, title, url, restricted | |
| `notifications.Notification` | recipient, actor, type (answer/reply/like/message/system), title, message, link, is_read | |

## 3. Authentication

- **Primary**: DRF Token auth — `Authorization: Token <key>` header. Login/register return the token; the frontend stores it in `localStorage`.
- **Secondary**: Django session auth (so the admin backend works).
- Global default permission is `AllowAny`; individual views override with `IsAuthenticated` / `IsAuthenticatedOrReadOnly` / `IsAdminUser`.
- `UNAUTHENTICATED_USER = None` — `request.user` is `None` (not `AnonymousUser`) when logged out.
- **AI sessions**: `GET /api/auth/ai-session/` returns a signed token (`chat-user-<id>`) that the Flask service validates via the shared `REI_SESSION_SECRET`.

## 4. Cross-cutting backend behavior

- **Content moderation**: `OpenSHSID_backend/moderation.py` rejects posts containing `BLOCKED_WORDS` (case-insensitive).
- **Auto-translation**: on Question/Article creation, a daemon thread calls Flask `/translate` and caches `source_lang` / `title_translated` / `content_translated`. The frontend switches display language via `utils/lang.js`.
- **Embedding init**: `signals.py` fills 32-dim random embeddings for new Questions/Articles (so recommendation ranking works immediately) and auto-creates `UserProfile` on signup.
- **SQLite pragmas**: every connection gets `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=20000` — mitigates lock contention from concurrent streaming writes.
- **Personalized ranking**: `knowledge/ranking.py` and `qa/views.py:_rank_questions` reorder lists for logged-in users using their embedding: `avg(max(item·heat − user, 0)) · 10` (algorithm mode), cached per user for 5 s.
- **@Rei streaming**: when an answer contains `@Rei`, `qa/views.py:_generate_rei_reply` creates an empty Answer (`is_streaming=True`), POSTs to the model service `/rei/stream` with a signed session token, and writes the SSE output to the DB in throttled increments so the frontend sees the reply "type itself out".
- **Notifications**: `notifications/signals.py` fires on new answers/replies, likes (M2M change), and DMs.

## 5. Management commands

| Command | Purpose |
|---|---|
| `python manage.py retranslate [--force] [--only qa\|knowledge]` | Re-run translation on Questions/Articles missing translations |
| `python manage.py crawl_linkedclassroom --username <u> --password <p> [--course-ids ...]` | CLI course sync from LinkedClassroom |

## 6. Django admin

Registered models are manageable at `/admin/`: all 7 apps' models with inline editing (Question+Answers, Course+Sections+Activities, Subbar with `filter_horizontal` managers, etc.). Requires a superuser (`python manage.py createsuperuser`).

---

**Next**: [04 — Backend: API Reference](04-backend-api.md)
