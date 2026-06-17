# 在本机 Windows 项目根目录运行：
#   自定义域名：  .\deploy\build-for-pages.ps1 -Domain https://graph.yourdomain.com
#   GitHub Pages： .\deploy\build-for-pages.ps1 -Domain https://你的用户名.github.io/仓库名
#
# 构建产物 dist/ 可上传到 Cloudflare Pages / GitHub Pages

param(
    [Parameter(Mandatory = $true)]
    [string]$Domain
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$normalized = $Domain.Trim().TrimEnd('/')
if ($normalized -notmatch '^https?://') {
    $normalized = "https://$normalized"
}

$envContent = @"
VITE_PUBLIC_APP_URL=$normalized
"@

Set-Content -Path ".env.production" -Value $envContent -Encoding UTF8
Write-Host "已写入 .env.production：" -ForegroundColor Green
Write-Host $envContent

npm run build:pages
Write-Host ""
Write-Host "构建完成。将 dist/ 部署到 Pages，并把域名 DNS 指过去。" -ForegroundColor Green
Write-Host "邀请链接将使用：$normalized" -ForegroundColor Cyan
