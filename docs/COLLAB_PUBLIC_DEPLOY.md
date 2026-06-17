# 公网远程协作部署指南

> **不买服务器、域名 + 静态站 + P2P（方案 C）**：见 [COLLAB_STATIC_PAGES.md](./COLLAB_STATIC_PAGES.md)（Cloudflare / GitHub Pages）。

> **华为云 openEuler + 仅 IP、无域名**：见 [COLLAB_HUAWEI_OPeneuler.md](./COLLAB_HUAWEI_OPeneuler.md)（含一键脚本）。

> 适用：不同城市、不同网络的策划通过 **HTTPS 网站 + WSS 协作服务** 同时编辑同一张画布。

---

## 1. 原理（先读这个）

| 组件 | 作用 |
|------|------|
| **静态前端**（`dist/`） | 浏览器打开的编辑器页面，可部署到任意 HTTPS 域名 |
| **协作服务**（`server/`） | WebSocket，实时同步**当前画布**的节点与连线 |
| **IndexedDB** | 仍在每人浏览器本地；协作是在线时对齐，不是云端项目库 |

**公网能用的条件：**

1. 前端有一个 **公网 HTTPS 地址**（例如 `https://graph.example.com`）
2. 协作服务有 **公网 WSS 地址**（推荐 `wss://graph.example.com/collab`，与网站同域）
3. 邀请链接必须是 **公网 URL**，不能是 `localhost`
4. 协作者打开链接后会 **自动加入同一协作房间**，画布数据从协作服务拉取（已实现 `?collab=1` 占位项目）

**当前 MVP 限制（务必知晓）：**

- **无账号 / 无密码**：知道房间 ID（URL 里的项目/画布 ID）的人都能进
- **只同步画布图数据**，不同步：自定义节点类型、DeepSeek Key、其它画布 Tab
- 协作服务 **重启后** 内存房间清空；每人本地 IndexedDB 仍保留最后一次内容
- 生产环境请自行加 **Nginx 限流 / IP 白名单 / 后续账号体系**

---

## 2. 准备

- 一台有 **公网 IP** 的云服务器（阿里云 / 腾讯云 / AWS 等）
- 一个域名，A 记录指向该服务器（例如 `graph.example.com`）
- 服务器已安装：**Node.js 20+**、**Nginx**、**Certbot**（免费 HTTPS 证书）

---

## 3. 构建前端（在你开发机上或 CI）

在项目根目录创建 **`.env.production`**（不要提交含密钥的文件）：

```env
# 用户浏览器访问的完整站点地址（不要末尾斜杠）
VITE_PUBLIC_APP_URL=https://graph.example.com

# 协作 WebSocket（HTTPS 站点必须用 wss）
VITE_PUBLIC_COLLAB_WS_URL=wss://graph.example.com/collab
```

构建：

```bash
npm install
npm run build
```

将生成的 **`dist/`** 目录上传到服务器，例如 `/var/www/game-design-graph/`。

---

## 4. 部署协作服务（云服务器）

```bash
# 上传 server/ 目录到服务器，例如 /opt/gdg-collab/server
cd /opt/gdg-collab/server
npm install
```

用 **pm2** 保持常驻（推荐）：

```bash
npm install -g pm2
pm2 start npm --name gdg-collab -- start
pm2 save
pm2 startup
```

默认监听 **`0.0.0.0:1234`**（仅本机/内网直连时用；公网应走 Nginx 反代，见下节）。

---

## 5. Nginx + HTTPS + WSS

参考仓库 **`deploy/nginx.conf.example`**。

核心要点：

- 443 端口提供 **静态前端**（`dist/`）
- 路径 **`/collab`** 反向代理到 `http://127.0.0.1:1234`（WebSocket 升级头必须配置）
- 用 Certbot 申请证书：`certbot --nginx -d graph.example.com`

申请证书后，用户访问 `https://graph.example.com` 时，前端会自动建议协作地址为  
`wss://graph.example.com/collab`（除非在设置里手动改过）。

---

## 6. 防火墙

开放：

- **80**（Certbot 验证 + 跳转 HTTPS）
- **443**（HTTPS / WSS）

**不要**对公网直接暴露 1234；只让 Nginx 本机访问 1234。

---

## 7. 使用流程

### 房主（主持协作的人）

1. 打开 `https://graph.example.com`，正常创建/打开项目
2. **设置 → 多人协作**：确认 WebSocket 为 `wss://graph.example.com/collab`，填写显示名称
3. 进入要协作的画布 → 点击 **「开始协作」**
4. 点击 **「复制邀请链接」** 发给同事（链接含 `?collab=1`）

### 协作者

1. 打开邀请链接（首次会在本地创建「协作项目」占位，属正常现象）
2. **设置** 里填 **相同的** WebSocket 地址与自己的显示名称
3. 页面会自动连接协作；顶部应显示「已协作 · N 人在线」
4. 双方同时编辑同一张图，变更实时同步

---

## 8. 常见问题

**Q：链接是 localhost，同事打不开？**  
A：必须用 **§3** 的 `VITE_PUBLIC_APP_URL` 重新构建并部署；或部署后手动用公网域名访问，不要用本机 dev 服务器链接。

**Q：HTTPS 页面提示 WebSocket 连接失败？**  
A：浏览器禁止 HTTPS 页面连接 `ws://`。必须使用 **`wss://`**，且 Nginx 要正确代理 `/collab`。

**Q：同事进来了但是空画布？**  
A：确保 **房主先「开始协作」** 且画布上已有内容；后进入的人会从协作房间拉取。若房主未在线且房间已空，需房主重新打开并协作。

**Q：和 Figma 一样有云端项目列表吗？**  
A：还没有。项目是 **每人本地 IndexedDB**；公网协作只保证 **同一画布 ID 的实时图数据** 一致。

---

## 9. 一键脚本（本机开发）

| 脚本 | 说明 |
|------|------|
| `start-with-collab.bat` | 本机双窗口：协作 + 前端（仅自测） |
| `npm run setup` | 安装前端 + 协作依赖 |

公网部署请按本文 **§3–§5** 操作，不要直接把 `localhost` 链接发给外网用户。
