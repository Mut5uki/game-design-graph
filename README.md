# Game Design Graph

面向游戏策划的 Web 端关系图编辑器：清晰展示与便捷编辑事件、能力、任务等设计要素及其依赖，内置 DeepSeek AI 辅助。

## 快速开始

### 单人编辑（本机）

双击 **`start.bat`**，或：

```bash
npm install
npm start
```

浏览器打开 http://localhost:3888

### 樱花协作（多人）

1. 双击 **`start-with-sakurafrp.bat`**（会启动协作服务 + 前端）
2. 樱花映射 **127.0.0.1:3888** 一条隧道
3. **设置 → 樱花协作** 填公网地址并保存

详见 [docs/COLLAB_SAKURAFRP.md](./docs/COLLAB_SAKURAFRP.md)

命令行等价：

```bash
npm run setup          # 首次：安装前端 + server 依赖
npm run start:collab   # 协作服务(1234) + 前端(3888)
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
