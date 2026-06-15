# Game Design Graph 启动脚本
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未找到 Node.js，请先安装：https://nodejs.org/" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "正在安装依赖，请稍候..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] 依赖安装失败" -ForegroundColor Red
        Read-Host "按 Enter 退出"
        exit 1
    }
}

Write-Host ""
Write-Host "启动 Game Design Graph ..." -ForegroundColor Green
Write-Host "浏览器将自动打开 http://localhost:3888"
Write-Host "按 Ctrl+C 可停止服务器"
Write-Host ""

npm run start

Write-Host ""
Write-Host "服务器已停止"
Read-Host "按 Enter 退出"
