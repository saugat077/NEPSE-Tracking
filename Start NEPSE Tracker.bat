@echo off
rem Launches the NEPSE Portfolio Tracker entirely on this PC (no cloud).
rem Serves frontend + API at http://localhost:18345 via Waitress.
rem (Uncommon port on purpose - avoids clashes with other dev projects.)
cd /d "%~dp0backend"

if not exist ".venv\Scripts\waitress-serve.exe" (
    echo Waitress not installed - run: .venv\Scripts\pip install waitress
    pause
    exit /b 1
)

start "NEPSE Tracker Server" /min .venv\Scripts\waitress-serve.exe --listen=127.0.0.1:18345 app:app
timeout /t 2 /nobreak >nul
start "" http://localhost:18345
