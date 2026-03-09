# Sugana Calendar — One-Command Install & Setup
# ================================================
# Run this on any Windows machine with Node.js 18+ installed.
# Powershell: .\install.ps1
#
# This script:
#   1. Installs server dependencies
#   2. Installs web dependencies + builds frontend
#   3. Runs the Azure SQL setup wizard
#   4. Starts the server

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Sugana Calendar - Install & Setup" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = $PSScriptRoot }

# Check Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "`n  Node.js is required. Download from: https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "`n  Node.js: $nodeVersion" -ForegroundColor Green

# Install server dependencies
Write-Host "`n  Installing server dependencies..." -ForegroundColor Yellow
Push-Location "$root\server"
npm install --omit=dev 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { npm install 2>&1 | Out-Null }
Pop-Location
Write-Host "  Server deps installed" -ForegroundColor Green

# Install web dependencies + build
Write-Host "  Installing web dependencies..." -ForegroundColor Yellow
Push-Location "$root\web"
npm install 2>&1 | Out-Null
Write-Host "  Building web frontend..." -ForegroundColor Yellow
npx vite build 2>&1 | Out-Null
Pop-Location
Write-Host "  Web frontend built" -ForegroundColor Green

# Check for config
$configPath = "$root\server\config.json"
if (-not (Test-Path $configPath)) {
    Write-Host "`n  No Azure SQL config found. Starting setup wizard..." -ForegroundColor Yellow
    Push-Location "$root\server"
    node setup.js
    Pop-Location
} else {
    Write-Host "`n  Config found: $configPath" -ForegroundColor Green
}

# Start server
if (Test-Path $configPath) {
    Write-Host "`n  Starting Sugana Calendar server..." -ForegroundColor Cyan
    Push-Location "$root\server"
    node server.js
}
