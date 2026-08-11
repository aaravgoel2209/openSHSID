# 08 — 开发规范与已知限制

> 相关文档：[目录](index.md) · [概述](01-overview.md) · [快速开始](02-quickstart.md) · [后端](03-backend.md) · [API](04-backend-api.md) · [前端](05-frontend.md) · [模型服务](06-model-service.md) · [部署](07-deployment.md)

## 1. 开发规范

### Commit 消息

提交主题必须以阶段标签开头：

```
Phrase (phrase代号) x.x.x pre(version) p(part) c(correction) fork-(fork) (merge)
```

历史示例：

```
Alpha a0.7.0pre2 Added Markdown previewer
Alpha a0.6.3 part2 p1 fixed cordova android preparing for ios
```

阶段为 0 的标签可省略。没有该头的提交一律不通过。

### 代码风格

- Python：**Black** 格式化（PyCharm 配置在 `.idea/misc.xml`）。
- 模型变更：始终执行 `makemigrations` + `migrate`。
- 前端：ESLint（`npm run lint`）；HeroUI 使用子路径导入（`@heroui/react/button`）；UI 文案默认中文（支持 i18n 处双语）。
- AI 会话认证文件（`OpenSHSID_backend/rei_session.py` ↔ `model/session_auth.py`）互为镜像——务必保持同步。

### 测试

- Django 测试桩文件存在于 `accounts/`、`qa/`、`knowledge/`、`chat/`、`postbar/`，但目前没有实际用例。`crawler/` 与 `notifications/` 连测试文件都没有。
- 前端暂无测试配置。

## 2. 已知限制

- **尚无自动化测试**（前后端均无实际用例）。
- **Flask 模型服务**依赖 LLM 接口（`REI_API_BASE`），**OCR 服务**依赖 CUDA GPU —— 两者均可优雅降级（翻译/OCR 报错，平台其余功能不受影响）。
- Docker Web 部署的 nginx **不代理** `/rei`、`/click`、`/translate` —— 纯 Docker 环境下 AI 对话需要另行路由这些路径。
- `simpletable/` 是废弃脚手架（无源码、未注册 `INSTALLED_APPS`），可安全删除。
- 爬虫将 LinkedClassroom 密码以明文存入数据库（`Credential.password`）；生产环境建议加密。
- Cordova 移动端：LinkedClassroom 弹窗登录在 WebView 中不可用；Django admin 链接外部打开。
- `config.json` 默认值（`debug: true`、`cors.allow_all: true`、弱 `django.secret_key` 兜底）面向开发/Docker——公网部署前务必加固。

---

**返回 [目录](index.md)**
