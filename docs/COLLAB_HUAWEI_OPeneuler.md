# 华为云 openEuler 部署指南（IP 访问 · 无域名）

> 适用：FlexusX / ECS · openEuler · 公网 IP（示例 `120.46.79.53`）  
> 访问：`http://公网IP` · 协作：`ws://公网IP/collab`

---

## 第 0 步：华为云控制台

1. 实例 **开机**（状态为「运行中」）
2. **安全组 → 入方向** 放行：
   - **TCP 22**（SSH，建议源 IP 填你的办公网）
   - **TCP 80**（HTTP）
   - **TCP 443**（以后上 HTTPS 再用）
3. **不要**对公网开放 **1234**（协作只走 Nginx `/collab`）

---

## 第 1 步：服务器初始化（SSH 登录后）

```bash
ssh root@120.46.79.53
```

上传并运行项目里的脚本（或逐条执行）：

```bash
# 若已把 deploy/openeuler-setup.sh 拷到服务器：
bash openeuler-setup.sh
```

脚本会安装：**curl、git、nginx、Node 20（nvm）、pm2**，并尝试放行 firewalld 的 80/443。

手动验证：

```bash
node -v    # 应 v20.x
nginx -v
pm2 -v
```

---

## 第 2 步：本机 Windows 构建前端

在项目根目录 PowerShell：

```powershell
# 默认 IP 120.46.79.53，可改参数
.\deploy\build-for-ip.ps1

# 或指定 IP
.\deploy\build-for-ip.ps1 -Ip 120.46.79.53
```

会生成 `.env.production` 并 `npm run build`，产物在 **`dist/`**。

---

## 第 3 步：上传到服务器

本机需已安装 **OpenSSH**（Windows 10+ 可选功能）。

```powershell
.\deploy\upload-to-server.ps1 -User root -Ip 120.46.79.53
```

首次连接会提示确认指纹，输入 **yes**，再输入 root 密码。

若不用脚本，可手动：

```powershell
scp -r dist/* root@120.46.79.53:/var/www/game-design-graph/
scp -r server/* root@120.46.79.53:/opt/gdg-collab/server/
scp deploy/nginx-ip.conf.example root@120.46.79.53:/etc/nginx/conf.d/game-design-graph.conf
```

---

## 第 4 步：服务器上启动协作服务

```bash
ssh root@120.46.79.53

cd /opt/gdg-collab/server
npm install
pm2 start npm --name gdg-collab -- start
pm2 save
pm2 startup    # 按提示执行它打印的那条命令，开机自启
pm2 status     # 应看到 gdg-collab online
```

确认本机监听：

```bash
curl -I http://127.0.0.1:1234   # 可能返回 426 等，说明进程在即可
```

---

## 第 5 步：Nginx

编辑配置（若 IP 不是 120.46.79.53，改 `server_name`）：

```bash
vi /etc/nginx/conf.d/game-design-graph.conf
nginx -t
systemctl reload nginx
```

浏览器访问：**http://120.46.79.53**  
应能看到项目列表页。

---

## 第 6 步：协作设置与测试

1. 打开 **http://120.46.79.53/settings#collab**
2. 协作 WebSocket 填：**`ws://120.46.79.53/collab`**（或留空用自动建议）
3. 填写显示名称 → 保存
4. 创建/打开项目 → 画布 → **开始协作** → **复制邀请链接**
5. 另一台电脑用同一链接打开，同样填 WebSocket 地址 → 应显示「已协作 · N 人在线」

---

## 更新版本（改代码后）

本机：

```powershell
.\deploy\build-for-ip.ps1
.\deploy\upload-to-server.ps1
```

服务器（仅协作代码变更时）：

```bash
cd /opt/gdg-collab/server && npm install
pm2 restart gdg-collab
```

仅前端变更：上传 `dist/` 即可，无需重启 pm2。

---

## 常见问题

**打不开 80 端口**  
→ 查华为云 **安全组** + 服务器 `systemctl status nginx`

**协作连接失败**  
→ `pm2 logs gdg-collab`  
→ `curl -I http://127.0.0.1/collab`（在服务器上）  
→ 浏览器设置里 WebSocket 必须是 **`ws://IP/collab`**，不是 `localhost`

**openEuler 没有 apt**  
→ 用 `yum` / `dnf`，不要用 Ubuntu 教程里的 `apt install`

**以后有域名 + HTTPS**  
→ 见 [COLLAB_PUBLIC_DEPLOY.md](./COLLAB_PUBLIC_DEPLOY.md)，把 `http/ws` 换成 `https/wss`

---

## 安全提醒（公网 IP 暴露）

- 当前 MVP **无登录**，知道 IP 的人都能打开站点
- 建议：安全组 **22 端口** 仅允许你的 IP；或 Nginx 对全站加 **Basic Auth**
- 策划数据仍在各自浏览器 IndexedDB；协作只同步当前画布
