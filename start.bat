@echo off
chcp 65001 >nul
title SHSID Campus

echo === SHSID Campus Starting... ===
echo.

:: AI session signing secret, shared by Flask + Django. Generated on first run
:: into .env.local (gitignored) so the secret never lands in the repo.
if not exist ".env.local" (
    echo [Setup]  Generating REI_SESSION_SECRET -^> .env.local
    python -c "import secrets;open('.env.local','w').write('REI_SESSION_SECRET='+secrets.token_urlsafe(48)+chr(10))"
)
for /f "usebackq tokens=1,* delims==" %%A in (".env.local") do set "%%A=%%B"

:: Start Flask (port 5000)
echo [Flask]  Starting...
start "Flask" /B python model\app.py

:: Wait a moment
timeout /t 2 /nobreak >nul

:: Run Django migrations
echo [Django] Running migrations...
python manage.py migrate
echo [Django] Migrations done.
echo.

:: Start Django (port 19424)
echo [Django] Starting...
start "Django" /B python manage.py runserver 19424

:: Wait for backends to actually accept connections before booting the
:: React dev server (Vite proxies /api to Django + Flask; starting it early
:: means the first requests race a not-yet-listening backend).
call :waitfor "Flask"  5000
call :waitfor "Django" 19424

:: Start React (port 5173)
echo [React]  Starting...
start "React" /B cmd /c "cd frontend && npm run dev"

echo.
echo Django  http://localhost:19424
echo Flask   http://localhost:5000
echo React   http://localhost:5173
echo.
echo Close this window to stop all services.
echo.

:wait
timeout /t 5 /nobreak >nul
goto wait

:: --- waitfor "<label>" <port> : poll a TCP port until it accepts a
:: connection, cap ~60s. Uses a raw TcpClient (proxy-independent, unlike curl).
:waitfor
set "_svc=%~1"
set "_port=%~2"
set /a _tries=0
:waitfor_loop
powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',%_port%);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 (
    echo [%_svc%]  ready.
    goto :eof
)
set /a _tries+=1
if %_tries% geq 30 (
    echo [%_svc%]  not ready after ~60s, starting React anyway.
    goto :eof
)
timeout /t 2 /nobreak >nul
goto waitfor_loop
