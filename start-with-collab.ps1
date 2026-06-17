# Game Design Graph — 协作服务 + 前端（两个窗口）
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未找到 Node.js，请先安装：https://nodejs.org/" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "正在安装前端依赖，请稍候..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

if (-not (Test-Path "server\node_modules")) {
    Write-Host "正在安装协作服务依赖，请稍候..." -ForegroundColor Yellow
    npm install --prefix server
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host ""
Write-Host "将打开两个窗口：" -ForegroundColor Cyan
Write-Host "  1. 协作 WebSocket  ws://localhost:1234"
Write-Host "  2. 前端编辑器      http://localhost:3888"
Write-Host ""

$collabCmd = "Set-Location '$PSScriptRoot'; npm run collab:server; Read-Host '按 Enter 关闭'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $collabCmd -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "启动前端 ..." -ForegroundColor Green
npm run start

Write-Host ""
Write-Host "前端已停止（协作服务窗口可能仍在运行）"
Read-Host "按 Enter 退出"
