# 快速上手：静态站 + P2P 协作（免费）

> 不买服务器。网页托管在 GitHub Pages（或 Cloudflare Pages），多人改画布走 **P2P**。

---

## 你会得到什么

| 有 | 没有 |
|----|------|
| 公网 HTTPS 链接打开编辑器 | 团队公共存档（各自浏览器 IndexedDB） |
| 邀请链接 + P2P 实时改**当前画布** | 静态站上 AI（无 DeepSeek 反代） |
| 免费 | 服务器模式 WebSocket |

---

## 方式 A：GitHub Pages（推荐，代码已在 GitHub 时）

### 1. 推送代码

确保项目在 GitHub 上，默认分支为 `master`。

### 2. 开启 Pages

1. 仓库 **Settings → Pages**
2. **Build and deployment → Source** 选 **GitHub Actions**

### 3. 触发部署

推送任意 commit 到 `master`，或 **Actions → Deploy GitHub Pages → Run workflow**。

首次成功后可访问（把用户名、仓库名换成你的）：

```text
https://你的用户名.github.io/你的仓库名/
```

若仓库名是 `你的用户名.github.io`，则地址为 `https://你的用户名.github.io/`。

### 4. （可选）自定义域名

在 Pages 设置里填域名，并在 DNS 添加 CNAME。  
然后在 **Settings → Actions → Variables** 增加：

```text
VITE_PUBLIC_APP_URL = https://graph.你的域名.com
```

重新跑一次部署 workflow。

不填 Variable 时，workflow 会自动用 `https://用户名.github.io/仓库名`。

---

## 方式 B：本机构建后手动上传

```powershell
# GitHub Pages 项目站示例
.\deploy\build-for-pages.ps1 -Domain https://你的用户名.github.io/你的仓库名

# 自定义域名示例
.\deploy\build-for-pages.ps1 -Domain https://graph.你的域名.com
```

将 `dist/` 整个目录上传到 Cloudflare Pages / 任意静态托管。

---

## 使用协作（P2P）

### 房主

1. 用 **公网 HTTPS 地址** 打开站点（不要用 localhost）
2. **设置 → 多人协作**
   - 协作方式：**P2P**（默认）
   - 信令：保持 `wss://signaling.yjs.dev`
   - 显示名称：填你的昵称
   - 「邀请链接地址」可留空（已从构建 URL 或当前页面推断）
3. 创建/打开项目 → 进入画布 → **开始协作** → **复制邀请链接**

### 协作者

1. 打开邀请链接（带 `?collab=1&mode=p2p`）
2. 设置里填显示名称，确认 **P2P**
3. 顶部 **「P2P · N 人在线」** 即可同时编辑

**注意：** 房主先开协作且画布有内容；后进入的人才会同步到图。

---

## 本地自测静态构建

```powershell
$env:VITE_PUBLIC_APP_URL = "https://你的用户名.github.io/你的仓库名"
npm run build:pages
npm run preview
```

浏览器打开 preview 给出的地址，检查路由与设置页协作项是否正常。

---

## 常见问题

**Q：邀请链接还是 localhost？**  
A：必须用公网 HTTPS 打开站点，或在设置里填「邀请链接地址」。

**Q：同事连不上 P2P？**  
A：检查公司网络是否屏蔽 WebRTC；可设 P2P 房间密码；换网络再试。

**Q：项目怎么备份？**  
A：静态站不写服务器硬盘。本机 `npm start` 编辑后 `git push` JSON，或导出/备份规划功能。

---

## 相关文档

- [COLLAB_STATIC_PAGES.md](./COLLAB_STATIC_PAGES.md) — 架构与 Cloudflare 细节
- [COLLAB_PUBLIC_DEPLOY.md](./COLLAB_PUBLIC_DEPLOY.md) — 买服务器 + WSS 方案
