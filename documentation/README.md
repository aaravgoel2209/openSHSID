# OpenSHSID — Documentation / 文档

> **OpenSHSID** is a modern re-implementation of the SHSID (Shanghai High School International Division) campus website — Q&A forum, knowledge base, direct messaging, postbar, AI campus assistant **Rei**, OCR toolbox, and LinkedClassroom course browsing.
>
> **OpenSHSID** 是上海中学国际部（SHSID）校园网站的新版现代化实现 —— 问答社区、知识库、站内私信、贴吧、AI 校园助手 **Rei**、OCR 工具箱与 LinkedClassroom 课程浏览。

## Languages / 语言

| Language | Index |
|---|---|
| **English (英文)** | [en/index.md](en/index.md) |
| **简体中文** | [zh/index.md](zh/index.md) |

## Structure / 文档结构

| # | English | 中文 | Contents / 内容 |
|---|---|---|---|
| 01 | [Overview & Architecture](en/01-overview.md) | [概述与架构](zh/01-overview.md) | Overview, architecture, tech stack, repo structure / 项目概述、系统架构、技术栈、仓库结构 |
| 02 | [Quick Start & Configuration](en/02-quickstart.md) | [快速开始与配置](zh/02-quickstart.md) | Setup, launch, `config.json`, env vars / 环境搭建、启动、配置与环境变量 |
| 03 | [Backend — Django](en/03-backend.md) | [后端 —— Django](zh/03-backend.md) | Apps, models, auth, cross-cutting / App、模型、认证、横切行为 |
| 04 | [Backend — API Reference](en/04-backend-api.md) | [后端 —— API 接口参考](zh/04-backend-api.md) | Complete `/api/*` endpoint reference / 完整 `/api/*` 端点参考 |
| 05 | [Frontend — React SPA](en/05-frontend.md) | [前端 —— React 单页应用](zh/05-frontend.md) | Routes, API layer, styling, PWA / 路由、API 层、样式、PWA |
| 06 | [Model Service — Flask AI](en/06-model-service.md) | [模型服务 —— Flask AI](zh/06-model-service.md) | Rei, RAG, recommendation, OCR / Rei、RAG、推荐、OCR |
| 07 | [Deployment](en/07-deployment.md) | [部署](zh/07-deployment.md) | Docker, Electron, Cordova / Docker、Electron、Cordova |
| 08 | [Development & Limitations](en/08-development.md) | [开发规范与已知限制](zh/08-development.md) | Conventions, testing, known issues / 规范、测试、已知限制 |

---

*Documentation generated from the codebase (Django 6.0.5 + React 19 / Vite 8 + Flask AI service). /* 本文档根据代码库生成。
