@echo off
setlocal
set ROOT=%~dp0

echo Demarrage Souq Auto...

start "Souq Auto" cmd /k "cd /d "%ROOT%app" && npm run dev"
timeout /t 3 /nobreak >nul

start http://localhost:5184

endlocal
