@echo off
echo ========================================
echo INSTALANDO EVOLUTION API - WhatsApp
echo ========================================
echo.

echo Verificando Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERRO: Docker nao encontrado!
    echo.
    echo Instale o Docker Desktop:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

echo Docker encontrado! Instalando Evolution API...
echo.

cd /d "%~dp0"

echo Criando arquivo docker-compose.yml...
(
echo version: '3.8'
echo services:
echo   evolution-api:
echo     image: atendai/evolution-api:latest
echo     container_name: evolution_api
echo     restart: always
echo     ports:
echo       - "8080:8080"
echo     environment:
echo       - SERVER_URL=http://localhost:8080
echo       - AUTHENTICATION_API_KEY=CHANGE_THIS_TO_RANDOM_KEY_123456
echo       - QRCODE_COLOR=#198754
echo     volumes:
echo       - evolution_data:/evolution/instances
echo.
echo volumes:
echo   evolution_data:
) > docker-compose-evolution.yml

echo Iniciando Evolution API...
docker-compose -f docker-compose-evolution.yml up -d

echo.
echo ========================================
echo EVOLUTION API INSTALADA COM SUCESSO!
echo ========================================
echo.
echo Acesse: http://localhost:8080
echo API Key: CHANGE_THIS_TO_RANDOM_KEY_123456
echo.
echo Documentacao: http://localhost:8080/manager
echo.
pause
