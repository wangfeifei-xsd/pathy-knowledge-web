# PowerShell one-click launcher for pathy-knowledge-web
param(
    [int]$Port = 5173,
    [string]$ApiTarget = "http://127.0.0.1:8765",
    # 与 vite `base` 一致；默认 `/wiki/`（访问 http://<host>:<port>/wiki/）；根路径开发可传 `/` 或 `-Base /`
    [string]$Base = "/wiki/"
)

$ErrorActionPreference = "Stop"

Write-Host "==> Starting pathy-knowledge-web on port $Port" -ForegroundColor Cyan
Write-Host "==> VITE_DEV_PROXY_TARGET = $ApiTarget" -ForegroundColor Cyan
$entryHint = if ($Base -eq '/' -or $Base -eq '') { "http://<host>:$Port/" } else { "http://<host>:$Port$Base" }
Write-Host "==> VITE_BASE = $Base (dev 入口一般为 $entryHint )" -ForegroundColor Cyan

$env:VITE_DEV_PROXY_TARGET = $ApiTarget
$env:VITE_BASE = $Base

Write-Host "==> Installing dependencies" -ForegroundColor Yellow
npm install

Write-Host "==> Launching Vite dev server" -ForegroundColor Green
npm run dev -- --host 0.0.0.0 --port $Port
