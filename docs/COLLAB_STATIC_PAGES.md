# 方案 C：域名 + 静态托管 + P2P（不买云服务器）

> **最快上手**：[QUICKSTART_STATIC_P2P.md](./QUICKSTART_STATIC_P2P.md)（GitHub Pages 逐步操作）

> 适合：不同城市同事通过 **HTTPS 公网链接** 协作编辑画布，**无需** 自建 WebSocket 服务器、**无需** 本机 24 小时开机。

---

## 1. 架构

| 组件 | 放哪里 | 费用 |
|------|--------|------|
| 编辑器网页（`dist/`） | Cloudflare Pages 或 GitHub Pages | 免费 |
| 自定义域名 | 域名商 + DNS | 域名年费 |
| 画布实时同步 | **P2P**（浏览器直连） | 免费 |
| 信令握手 | 公共 `wss://signaling.yjs.dev` | 免费 |
| 项目数据 | 每人浏览器 IndexedDB | — |

**不需要：** 华为云 / 协作服务 `server/` / `start-with-collab.bat`。

---

## 2. 你需要准备

1. 一个域名（如 `yourdomain.com`）
2. GitHub 账号（代码已在 GitHub 更方便；也可本机构建后手动上传 `dist/`）
3. 推荐 **Cloudflare** 账号（免费，绑域名 + Pages 一条龙）

---

## 3. 构建（写入公网邀请链接地址）

在项目根目录：

```powershell
.\deploy\build-for-pages.ps1 -Domain https://graph.yourdomain.com
```

或手动创建 `.env.production`（参考 `deploy/env.production.pages.example`）后：

```bash
npm run build:pages
```

构建会把 **`VITE_PUBLIC_APP_URL`** 写进前端，复制邀请链接时自动用 `https://graph.yourdomain.com`，不再是 localhost。

---

## 4. 部署方式（二选一）

### A. Cloudflare Pages（推荐）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → 连接 GitHub 仓库
2. 构建设置：
   - **Build command:** `npm run build:pages`
   - **Build output directory:** `dist`
   - **Environment variable:** `VITE_PUBLIC_APP_URL` = `https://graph.yourdomain.com`
3. **Custom domains** → 添加 `graph.yourdomain.com`
4. 在域名 DNS 处把该子域名 CNAME 到 Pages 提供的地址（若域名已在 Cloudflare，通常一键完成）

仓库已包含 `public/_redirects`，用于 SPA 路由（刷新 `/project/...` 不 404）。

### B. GitHub Pages

1. 仓库 **Settings → Pages → Source** 选 **GitHub Actions**
2. **Settings → Secrets and variables → Actions → Variables** 添加：
   - `VITE_PUBLIC_APP_URL` = `https://graph.yourdomain.com`
3. 推送 `main` 分支，工作流 `.github/workflows/deploy-pages.yml` 会自动部署
4. Pages 设置里填写 **Custom domain**，并在域名商添加 CNAME 到 `你的用户名.github.io`

---

## 5. 使用流程

### 房主

1. 打开 `https://graph.yourdomain.com`
2. **设置 → 多人协作**
   - 协作方式：**P2P**（默认）
   - 信令：保持 `wss://signaling.yjs.dev` 即可
   - 「邀请链接地址」可留空（构建时已写入域名）；若留空且从公网域名访问，也会自动用当前站点地址
3. 打开项目 → 进入画布 → **开始协作** → **复制邀请链接** 发给同事

### 协作者

1. 打开邀请链接（含 `?collab=1&mode=p2p`）
2. 设置里填显示名称，确认协作方式为 **P2P**
3. 顶部显示「已协作 · N 人在线」即可同时编辑

---

## 6. 限制（务必知晓）

| 项目 | 说明 |
|------|------|
| 项目列表 | 仍在各自浏览器，**没有**云端项目库 |
| 房主离线 | 房间依赖 P2P；建议协作时至少一人在线并已「开始协作」 |
| 硬盘同步 | 静态站无 `/api/local-data`，仅 IndexedDB（与本地 dev 的 `data/projects` 不同步） |
| AI 功能 | 静态站**没有** DeepSeek 反代；协作与手动画布正常，AI 需本地 dev 或后续加 Worker |
| 安全 | 知道房间 URL 的人可加入；重要项目请设 P2P 房间密码 |

---

## 7. 常见问题

**Q：还要填 localhost 吗？**  
A：不要。部署后用 **https://你的域名** 访问；构建时设好 `VITE_PUBLIC_APP_URL` 即可。

**Q：和买云服务器那套有什么区别？**  
A：本文 **不买服务器**；协作用 P2P，不跑 `server/`。云服务器方案见 [COLLAB_PUBLIC_DEPLOY.md](./COLLAB_PUBLIC_DEPLOY.md)（服务器模式、WSS 反代）。

**Q：GitHub Pages 和 Cloudflare Pages 选哪个？**  
A：已有 Cloudflare 管 DNS 选 **Cloudflare Pages** 更省事；已在 GitHub 且不想迁 DNS 可用 **GitHub Pages**。

**Q：子路径部署（如 `example.com/graph/`）？**  
A：当前默认根路径 `/`。子路径需在 Vite 配置 `base` 并重新构建，一般自定义子域名 `graph.example.com` 更简单。

---

## 8. 相关文件

| 文件 | 说明 |
|------|------|
| `deploy/build-for-pages.ps1` | 一键按域名构建 |
| `deploy/env.production.pages.example` | 环境变量示例 |
| `public/_redirects` | Cloudflare SPA 回退 |
| `scripts/pages-postbuild.mjs` | 生成 `404.html`（GitHub Pages） |
| `.github/workflows/deploy-pages.yml` | GitHub Actions 部署 |
