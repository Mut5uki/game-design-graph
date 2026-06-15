# Game Design Graph

面向游戏策划的 Web 端关系图编辑器：清晰展示与便捷编辑事件、能力、任务等设计要素及其依赖，内置 DeepSeek AI 辅助。

## 快速开始

**方式一（推荐）**：双击项目根目录的 **`start.bat`**，会自动安装依赖（首次）、启动服务器并打开浏览器。

**方式二**：命令行

```bash
npm install
npm start
```

浏览器将自动打开 http://localhost:3888

仅启动服务器、不自动开浏览器：

```bash
npm run dev
```

## 功能概览

- **项目管理**：本地 IndexedDB 持久化，多画布
- **画布编辑**：拖拽节点、连线、自动布局、Undo/Redo
- **表格视图**：批量浏览与编辑节点
- **影响分析**：选中节点高亮上下游依赖
- **校验面板**：检测依赖环、孤立节点、悬空连线
- **DeepSeek AI**：自然语言生成关系图、补全节点、设计问答

## 数据存储

- **项目数据**：浏览器 IndexedDB，纯本地，无云端账号
- **API Key**：加密存在本机，不上传任何自建服务器；仅在你点击 AI 时由浏览器发往 DeepSeek
- 换浏览器/清缓存会丢数据，重要项目请留意备份（导出备份功能规划中）

## 配置 AI

1. 创建项目后进入 **设置**
2. 填入 [DeepSeek](https://platform.deepseek.com/) API Key（按项目存储，本地加密）
3. 在编辑器右侧 **AI 助手** 面板使用

> AI 请求经开发代理转发至 DeepSeek（`/api/deepseek`），生产部署时需保留同等代理或确认浏览器 CORS 策略。

## 文档

完整开发指南见 [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)

## 技术栈

React 19 · TypeScript · Vite · XYFlow · Zustand · Dexie · Tailwind CSS · DeepSeek API

## 状态

MVP v0.1 — 单人本地 Web 版
