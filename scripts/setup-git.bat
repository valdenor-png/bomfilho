@echo off
REM ============================================
REM SCRIPT DE INICIALIZAÇÃO - GIT SETUP
REM Versão CMD para quem não usa PowerShell
REM ============================================

echo ========================================
echo   CONFIGURANDO PROJETO PARA GIT
echo ========================================
echo.

REM Verificar se Git está instalado
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Git nao esta instalado!
    echo Baixe em: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo [OK] Git encontrado
echo.

REM Verificar se já é um repositório Git
if exist ".git" (
    echo [AVISO] Este projeto ja e um repositorio Git
    set /p resposta="Deseja reinicializar? (s/N): "
    if /i not "%resposta%"=="s" (
        echo Operacao cancelada.
        pause
        exit /b 0
    )
    rmdir /s /q ".git"
)

REM Inicializar Git
echo Inicializando repositorio Git...
git init
git branch -M main

REM Adicionar todos os arquivos
echo Adicionando arquivos ao Git...
git add .

REM Fazer commit inicial
echo Criando commit inicial...
git commit -m "feat: Projeto inicial - Bom Filho Supermercado"

echo.
echo ========================================
echo   REPOSITORIO GIT CONFIGURADO!
echo ========================================
echo.
echo PROXIMOS PASSOS:
echo.
echo 1. Criar repositorio no GitHub:
echo    https://github.com/new
echo    Nome: bom-filho-supermercado
echo.
echo 2. Conectar ao GitHub (substitua SEU_USUARIO):
echo    git remote add origin https://github.com/SEU_USUARIO/bom-filho-supermercado.git
echo.
echo 3. Enviar codigo:
echo    git push -u origin main
echo.
echo Para mais detalhes, veja: GUIA_GITHUB.md
echo.

pause
