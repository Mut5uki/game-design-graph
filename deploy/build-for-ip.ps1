# 在本机 Windows 项目根目录运行：.\deploy\build-for-ip.ps1
# 可选参数：.\deploy\build-for-ip.ps1 -Ip 120.46.79.53

param(
    [string]$Ip = "120.46.79.53"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$envContent = @"
VITE_PUBLIC_APP_URL=http://$Ip
VITE_PUBLIC_COLLAB_WS_URL=ws://${Ip}/collab
"@

Set-Content -Path ".env.production" -Value $envContent -Encoding UTF8
Write-Host "已写入 .env.production：" -ForegroundColor Green
Write-Host $envContent

npm run build
Write-Host ""
Write-Host "构建完成，产物在 dist/ 目录" -ForegroundColor Green
