# 樱花 FRP（SakuraFrp）协作穿透指南

用 **樱花内网穿透** 把本机的编辑器（3888）和协作服务（1234）暴露给外地同事，协作方式选 **服务器（WebSocket）**，比静态站 P2P 稳定。

---

## 1. 准备

1. 注册 [SakuraFrp / natfrp.com](https://natfrp.com/) 并完成实名（海外节点通常只需实名）
2. 安装 **启动器**（推荐）或下载 **frpc**：[官方文档](https://doc.natfrp.com/launcher/usage.html)
3. 本机已安装 Node.js，项目能正常运行 `start-with-collab.bat`

---

## 2. 在樱花面板创建两条隧道

两条隧道 **同一节点**，类型建议 **TCP**（简单、WebSocket 友好）。

| 名称（自定） | 隧道类型 | 本地 IP | 本地端口 | 说明 |
|-------------|---------|---------|---------|------|
| gdg-web | TCP | `127.0.0.1` | **3888** | Vite 编辑器网页 |
| gdg-ws | TCP | `127.0.0.1` | **1234** | 协作 WebSocket |

**HTTPS 页面 + WSS 协作（推荐，避免浏览器 mixed content）：**

- **gdg-web** 隧道：开启 **自动 HTTPS**（工作模式选 `http` 或留空自动探测）
- **gdg-ws** 隧道：开启 **自动 HTTPS**，工作模式选 **passthrough**（直通 WebSocket）

启动隧道后，在 **日志** 里会看到公网访问地址，例如：

```text
gdg-web  → https://cn-xx.natfrp.cloud:51906
gdg-ws   → wss://cn-xx.natfrp.cloud:51907   （或 wss://... 形式，以面板为准）
```

若暂时只用 HTTP（无自动 HTTPS）：

```text
gdg-web  → http://cn-xx.natfrp.cloud:51906
gdg-ws   → ws://cn-xx.natfrp.cloud:51907
```

**注意：** 网页是 `https://` 时，协作地址必须是 `wss://`，不能填 `ws://`。

---

## 3. 启动 frpc / 启动器

### 方式 A：樱花启动器（推荐）

1. 登录启动器，勾选 **gdg-web**、**gdg-ws** 两条隧道并启动
2. 在日志中复制两条隧道的访问地址

### 方式 B：命令行 frpc

1. 面板 → 勾选两条隧道 → **批量操作 → 配置文件**，复制启动参数  
2. 示例：

```powershell
frpc_windows_amd64.exe -f <你的访问密钥>:<隧道ID1>,<隧道ID2>
```

也可复制 `deploy/sakurafrp/frpc.local.cmd.example` 为 `frpc.local.cmd`，填入参数后双击。

---

## 4. 启动本机服务

**方式一：** 双击 **`start-with-sakurafrp.bat`**

- 自动开协作服务（1234）+ 前端（3888）
- 若存在 `deploy/sakurafrp/frpc.local.cmd` 会尝试启动 frpc

**方式二：** 先 `start-with-collab.bat`，再单独开樱花隧道

---

## 5. 写入编辑器设置

1. 打开编辑器 → **设置 → 多人协作**
2. 在 **樱花 FRP** 区域填入面板日志里的两条地址
3. 点 **套用 Sakura FRP** → **保存协作设置**
4. 进入画布 → **开始协作** → **复制邀请链接** 发给同事

同事打开链接后会自动加入（URL 含 `?collab=1`）；协作方式为 **服务器**，WebSocket 走你穿透出来的地址。

---

## 6. 自检清单

| 检查项 | 做法 |
|--------|------|
| 本机网页 | 浏览器打开 `http://127.0.0.1:3888` 能进编辑器 |
| 本机协作 | 协作服务窗口无报错，监听 1234 |
| 穿透网页 | 用樱花给的 **公网地址** 打开，能进编辑器 |
| 设置一致 | 邀请链接地址 = 网页隧道；WS = 协作隧道（https 配 wss） |
| 防火墙 | 一般只需本机服务；无需对公网开放 3888/1234 |

---

## 7. 常见问题

**同事打不开邀请链接**  
→ 检查「邀请链接地址」是否为樱花 **公网 URL**，不是 localhost。

**能开网页但协作连不上**  
→ 协作 WebSocket 地址是否填对；HTTPS 页面是否用了 `wss://`。

**frpc 报「无法连接到本地服务」**  
→ 先运行 `start-with-sakurafrp.bat`，确认 3888 / 1234 在本机已监听，再开隧道。

**内地节点 + HTTP 隧道**  
→ 内地 HTTP(S) 隧道可能要求备案域名；可改用 **TCP + 海外节点**，或 TCP 自动 HTTPS。

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `start-with-sakurafrp.bat` | 协作 + 前端 + 可选 frpc |
| `deploy/sakurafrp/frpc.local.cmd.example` | frpc 启动参数模板 |
| `start-with-collab.bat` | 仅本机协作（不穿透） |
