@echo off
echo Iniciando servidor Bom Filho...
cd /d "%~dp0"
:loop
node server.js
echo.
echo Servidor encerrado! Reiniciando em 3 segundos...
timeout /t 3 /nobreak
goto loop
