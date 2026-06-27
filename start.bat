@echo off
chcp 65001 >nul
title SHSID Campus

echo === SHSID Campus Starting... ===
echo.

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

:: Start Django (port 8000)
echo [Django] Starting...
start "Django" /B python manage.py runserver 19424

:: Wait a moment
timeout /t 2 /nobreak >nul

:: Start React (port 5173)
echo [React]  Starting...
start "React" /B cmd /c "cd frontend && npm run dev"

echo.
echo Django  http://localhost:8000
echo Flask   http://localhost:5000
echo React   http://localhost:5173
echo.
echo Close this window to stop all services.
echo.

:wait
timeout /t 5 /nobreak >nul
goto wait
