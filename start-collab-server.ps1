# Game Design Graph — 仅启动协作 WebSocket 服务
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未找到 Node.js，请先安装：https://nodejs.org/" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

if (-not (Test-Path "server\node_modules")) {
    Write-Host "正在安装协作服务依赖，请稍候..." -ForegroundColor Yellow
    npm install --prefix server
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] 协作服务依赖安装失败" -ForegroundColor Red
        Read-Host "按 Enter 退出"
        exit 1
    }
}

Write-Host ""
Write-Host "启动协作 WebSocket 服务 ..." -ForegroundColor Green
Write-Host "地址：ws://localhost:1234"
Write-Host "按 Ctrl+C 可停止"
Write-Host ""

npm run collab:server

Write-Host ""
Write-Host "协作服务已停止"
Read-Host "按 Enter 退出"
