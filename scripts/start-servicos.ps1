$ErrorActionPreference = 'Stop'

$rootPath = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $rootPath 'backend'
$spaPath = Join-Path $rootPath 'frontend-react'

if (-not (Test-Path $backendPath)) {
  Write-Host "❌ Pasta backend não encontrada em: $backendPath" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $spaPath)) {
  Write-Host "❌ Pasta frontend-react não encontrada em: $spaPath" -ForegroundColor Red
  exit 1
}

Write-Host "🚀 Iniciando backend e SPA..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$backendPath'; npm run dev"
) | Out-Null

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$spaPath'; npm run dev -- --host 127.0.0.1 --port 5173"
) | Out-Null

Start-Sleep -Seconds 2

try {
  $backendStatus = (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/produtos' -TimeoutSec 5).StatusCode
} catch {
  $backendStatus = 'OFFLINE'
}

try {
  $spaStatus = (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173' -TimeoutSec 5).StatusCode
} catch {
  $spaStatus = 'OFFLINE'
}

Write-Host "📡 BACKEND: $backendStatus" -ForegroundColor Yellow
Write-Host "🧩 SPA: $spaStatus" -ForegroundColor Yellow
Write-Host "✅ Pronto. Use o index em 5500 e links para /#/sobre e /#/conta." -ForegroundColor Green
