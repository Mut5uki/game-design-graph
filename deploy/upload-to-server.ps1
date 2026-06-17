# 在本机运行（需 OpenSSH 客户端）：.\deploy\upload-to-server.ps1 -User root
# 会打包上传 dist/ 与 server/

param(
    [string]$Ip = "120.46.79.53",
    [string]$User = "root"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

if (-not (Test-Path "dist\index.html")) {
    Write-Host "请先运行 .\deploy\build-for-ip.ps1 或 npm run build" -ForegroundColor Red
    exit 1
}

$Target = "${User}@${Ip}"
Write-Host "上传到 $Target ..." -ForegroundColor Cyan

ssh $Target "mkdir -p /opt/gdg-collab/server /var/www/game-design-graph"

scp -r dist/* "${Target}:/var/www/game-design-graph/"
scp -r server/* "${Target}:/opt/gdg-collab/server/"
scp deploy/nginx-ip.conf.example "${Target}:/etc/nginx/conf.d/game-design-graph.conf"
scp deploy/openeuler-setup.sh "${Target}:/root/openeuler-setup.sh"

Write-Host ""
Write-Host "文件已上传。请在服务器上执行：" -ForegroundColor Green
Write-Host @"

  ssh $Target

  # 首次：安装环境
  bash /root/openeuler-setup.sh

  cd /opt/gdg-collab/server && npm install
  pm2 start npm --name gdg-collab -- start
  pm2 save
  pm2 startup

  nginx -t && systemctl reload nginx

"@
