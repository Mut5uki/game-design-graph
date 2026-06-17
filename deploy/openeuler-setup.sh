#!/bin/bash
# 在华为云 openEuler 上运行（root 或 sudo）
# curl -fsSL 你的仓库raw地址/openeuler-setup.sh | bash
# 或 scp 到服务器后：bash openeuler-setup.sh

set -e

echo "==> 安装基础工具"
if command -v dnf &>/dev/null; then
  PKG=dnf
elif command -v yum &>/dev/null; then
  PKG=yum
else
  echo "未找到 yum/dnf"; exit 1
fi

$PKG install -y curl git nginx firewalld || true

echo "==> 安装 Node.js 20（nvm）"
export NVM_DIR="/root/.nvm"
if [ ! -d "$NVM_DIR" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
npm install -g pm2

echo "==> 创建目录"
mkdir -p /opt/gdg-collab/server
mkdir -p /var/www/game-design-graph

echo "==> 防火墙（若 firewalld 在运行）"
if systemctl is-active --quiet firewalld 2>/dev/null; then
  firewall-cmd --permanent --add-service=http || true
  firewall-cmd --permanent --add-service=https || true
  firewall-cmd --reload || true
  echo "已放行 http/https（请在华为云控制台安全组同样放行 80/443）"
fi

echo "==> 启用 Nginx"
systemctl enable nginx
systemctl start nginx

echo ""
echo "完成。Node: $(node -v)  npm: $(npm -v)"
echo "下一步："
echo "  1. 上传 server/ 到 /opt/gdg-collab/server 并 npm install && pm2 start"
echo "  2. 上传 dist/ 到 /var/www/game-design-graph"
echo "  3. 复制 deploy/nginx-ip.conf.example 到 /etc/nginx/conf.d/game-design-graph.conf"
echo "  4. nginx -t && systemctl reload nginx"
