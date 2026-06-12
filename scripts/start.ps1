# SHSID campus - start all services
param()

$Root = Split-Path -Parent $PSScriptRoot

Write-Host "=== SHSID start ===" -ForegroundColor Cyan

# 1. Flask (port 5000)
$FlaskJob = Start-Job -Name flask -ScriptBlock {
  Set-Location $using:Root\model
  python -m flask run --port 5000
}
Write-Host "[Flask]  starting..." -ForegroundColor Green

# 2. Django (port 8000)
$DjangoJob = Start-Job -Name django -ScriptBlock {
  Set-Location $using:Root
  python manage.py runserver 19424
}
Write-Host "[Django] starting..." -ForegroundColor Green

Start-Sleep 2

# 3. React (port 5173)
$ReactJob = Start-Job -Name react -ScriptBlock {
  Set-Location $using:Root\frontend
  npm run dev
}
Write-Host "[React]  starting..." -ForegroundColor Green

Write-Host ""
Write-Host "Django http://localhost:19424" -ForegroundColor Yellow
Write-Host "Flask  http://localhost:5000" -ForegroundColor Yellow
Write-Host "React  http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop all" -ForegroundColor Magenta

Wait-Job -Job $FlaskJob, $DjangoJob, $ReactJob -Any | Out-Null

Write-Host "Stopping all services..." -ForegroundColor Red
Stop-Job -Job $FlaskJob, $DjangoJob, $ReactJob
Remove-Job -Job $FlaskJob, $DjangoJob, $ReactJob -Force
