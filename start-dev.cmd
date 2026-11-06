@echo off
REM Inicia o Digitusul Hub em modo desenvolvimento (http://localhost:3000)
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
node node_modules\next\dist\bin\next dev -p 3000
