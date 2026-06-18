# 樱花 FRP 协作主机（PowerShell）
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未找到 Node.js" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "安装前端依赖…" -ForegroundColor Yellow
    npm install
}

if (-not (Test-Path "server\node_modules")) {
    Write-Host "安装协作服务依赖…" -ForegroundColor Yellow
    npm run collab:install
}

Write-Host ""
Write-Host "樱花协作：隧道映射 127.0.0.1:3888，详见 docs/COLLAB_SAKURAFRP.md" -ForegroundColor Cyan
Write-Host ""

$frpc = Join-Path $PSScriptRoot "deploy\sakurafrp\frpc.local.cmd"
if (Test-Path $frpc) {
    Start-Process cmd -ArgumentList "/k", "cd /d `"$(Join-Path $PSScriptRoot 'deploy\sakurafrp')`" && call frpc.local.cmd" -WindowStyle Normal
    Start-Sleep -Seconds 2
}

npm run start:collab

Read-Host "按 Enter 退出"
