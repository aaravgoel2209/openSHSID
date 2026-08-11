# 04 — Backend: API Reference

> Applies to: [Index](index.md) · [Overview](01-overview.md) · [Quick Start](02-quickstart.md) · [Backend](03-backend.md) · [Frontend](05-frontend.md) · [Model Service](06-model-service.md) · [Deployment](07-deployment.md) · [Development](08-development.md)

All endpoints live under `/api/`. Unless noted, GET is public and mutations require auth. Auth header: `Authorization: Token <key>`.

## 1. Auth — `/api/auth/`

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `register/` | public | `{username, password}` → `{token, user}` (201) |
| POST | `login/` | public | → `{token, user}` |
| GET | `profile/` | auth | Current user |
| GET | `users/<id>/` | public | Public profile |
| GET | `notices/` | public | Site notices; POST requires staff |
| DELETE | `notices/<id>/` | staff | |
| GET | `weekly-top/` | public | Top 5 users by heat, last 7 days |
| POST | `avatar/upload/` | auth | Multipart, JPG/PNG/GIF/WebP ≤ 5 MB |
| GET | `ai-session/` | auth | Signed AI chat session token |
| GET | `admin/dashboard/` | staff | Platform stats + time series |
| GET | `admin/users/` | staff | User list |
| GET/PATCH/DELETE | `admin/users/<id>/` | staff | Manage a user |
| GET | `admin/content/` | staff | Content list (`?type=`) |
| DELETE | `admin/content/<kind>/<id>/` | staff | Delete content |

## 2. Q&A — `/api/qa/`

| Method | Path | Notes |
|---|---|---|
| GET | `labels/` | Label list |
| GET/POST | `questions/` | List (`?search=`; personalized ranking when logged in) / create (moderation + async translation; `labels: []`) |
| GET | `questions/<id>/` | Detail with answers |
| POST | `questions/<id>/view/` | Increment view count |
| POST | `questions/<id>/like/` | Toggle like (auth) |
| GET/POST | `questions/<id>/answers/` | List / create. `@Rei` mention → streaming AI reply |
| DELETE | `questions/<id>/answers/` | Delete (staff) |
| POST | `answers/<id>/like/` | Toggle like (auth) |

## 3. Knowledge base — `/api/knowledge/`

| Method | Path | Notes |
|---|---|---|
| GET | `grades/` / `subjects/` | Filters |
| GET/POST | `articles/` | List (`?grade=&subject=&label=&search=`) / create (moderation + translation) |
| GET | `search-titles/` | Title autocomplete (`?q=&limit=`) |
| GET/DELETE | `articles/<id>/` | Detail / delete (staff) |
| POST | `articles/<id>/view/` | Increment views |
| POST | `articles/<id>/like/` | Toggle like (auth) |
| GET/POST/DELETE | `articles/<id>/comments/` | Nested comments |
| POST | `comments/<id>/like/` | Toggle like (auth) |
| GET | `memory/` | Staff: Rei memory entries (reads the model's local DB) |
| POST | `ocr-import/` | Staff: placeholder OCR import |
| POST | `ocr-scan/` | Auth: upload → OCR → Markdown |
| POST | `ocr-scan-stream/` | Auth: NDJSON streaming OCR (large PDFs) |
| POST | `ocr-summarize/` | Auth: LLM summary of OCR text |
| POST | `ocr-save/` | Auth: save OCR result as a knowledge article |

## 4. Chat — `/api/chat/`

| Method | Path | Notes |
|---|---|---|
| GET | `conversations/` | Auth: conversation list with unread counts |
| POST | `conversations/<user_id>/read/` | Mark conversation read |
| GET/POST | `messages/` | Auth: list (`?user=`) / send |
| GET | `users/` | Auth: user search (`?q=`) |

## 5. Notifications — `/api/notifications/`

| Method | Path | Notes |
|---|---|---|
| GET | `` | Last 100 notifications |
| GET | `unread-count/` | |
| POST | `read-all/` | |
| POST | `<id>/read/` | |
| DELETE | `clear/` | |

## 6. Crawler — `/api/crawler/`

| Method | Path | Notes |
|---|---|---|
| GET/POST/DELETE | `credentials/` | Per-user LC credentials (password never returned) |
| POST | `sync/` | Staff: crawl LinkedClassroom and upsert courses |
| GET | `courses/` | Synced course list |
| GET | `courses/<course_id>/` | Course detail with sections + activities |
| GET | `image-proxy/` | Proxy LC images through an authenticated session |
| GET | `download/` | Proxy-download LC resources |
| GET | `browser-login/` | HTML page that auto-submits LC login (installs session cookie) |
| POST | `clear-cache/` | Staff: clear cached LC sessions |

## 7. Postbar — `/api/postbar/`

| Method | Path | Notes |
|---|---|---|
| GET/POST | `subbars/` | List (`?search=`) / create |
| GET | `subbars/<id>/` | Detail |
| GET/POST/DELETE | `subbars/<id>/managers/` | Manager list / add / remove (owner only) |
| GET/POST | `subbars/<id>/posts/` | Posts in a subbar |
| GET/DELETE | `posts/<id>/` | Detail / delete (bar managers) |
| POST | `posts/<id>/view/` | Increment views |
| POST | `posts/<id>/like/` | Toggle like (auth) |
| GET/POST/DELETE | `posts/<id>/comments/` | Nested comments |
| POST | `comments/<id>/like/` | Toggle like (auth) |

## 8. Root URL map

```
OpenSHSID_backend/urls.py
├── admin/                              (Django admin)
├── api/qa/         → qa.urls           (8 routes)
├── api/knowledge/  → knowledge.urls    (14 routes incl. OCR + memory)
├── api/auth/       → accounts.urls     (13 routes incl. admin dashboard)
├── api/chat/       → chat.urls         (4 routes)
├── api/notifications/ → notifications.urls (5 routes)
├── api/crawler/    → crawler.urls      (8 routes)
├── api/postbar/    → postbar.urls      (9 routes)
└── /media/...                          (static() in dev)
```

---

**Next**: [05 — Frontend: React SPA](05-frontend.md)
