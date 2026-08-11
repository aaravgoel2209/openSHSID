# 08 — Development & Limitations

> Applies to: [Index](index.md) · [Overview](01-overview.md) · [Quick Start](02-quickstart.md) · [Backend](03-backend.md) · [API](04-backend-api.md) · [Frontend](05-frontend.md) · [Model Service](06-model-service.md) · [Deployment](07-deployment.md)

## 1. Development conventions

### Commit messages

Commit subjects must start with a phase tag:

```
Phrase (phrase code) x.x.x pre(version) p(part) c(correction) fork-(fork) (merge)
```

Examples from the history:

```
Alpha a0.7.0pre2 Added Markdown previewer
Alpha a0.6.3 part2 p1 fixed cordova android preparing for ios
```

Zero-value tags may be omitted. Commits without the tag are rejected.

### Code style

- Python: **Black** formatting (PyCharm config in `.idea/misc.xml`).
- Model changes: always `makemigrations` + `migrate`.
- Frontend: ESLint (`npm run lint`); HeroUI deep imports (`@heroui/react/button`); all UI text in Chinese (with i18n where supported).
- The AI session auth files (`OpenSHSID_backend/rei_session.py` ↔ `model/session_auth.py`) are mirrors — keep them in sync.

### Testing

- Django test stubs exist in `accounts/`, `qa/`, `knowledge/`, `chat/`, `postbar/` but contain no test cases yet. `crawler/` and `notifications/` have no test files.
- Frontend has no test setup yet.

## 2. Known limitations

- **No automated tests** are written yet (backend or frontend).
- The **Flask model service** requires an LLM endpoint (`REI_API_BASE`) and the **OCR service** requires a CUDA GPU — both degrade gracefully (translation/OCR return errors; the rest of the platform keeps working).
- The Docker web deploy's nginx does **not** proxy `/rei`, `/click`, `/translate` — the AI chat feature needs those routed another way in a pure-Docker setup.
- `simpletable/` is dead scaffolding (no source, not in `INSTALLED_APPS`) — safe to remove.
- The crawler stores LinkedClassroom passwords in plaintext in the DB (per-user `Credential.password`); consider encryption for production.
- Cordova mobile: LinkedClassroom popup login is broken in WebViews; Django admin link opens externally.
- `config.json` defaults (`debug: true`, `cors.allow_all: true`, weak `django.secret_key` fallback) are dev/Docker-oriented — harden before public deployment.

---

**Back to [Index](index.md)**
