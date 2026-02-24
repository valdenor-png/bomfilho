# ============================================
# VERIFICADOR DE PROJETO
# Verifica se está tudo pronto para transferir
# ============================================

Write-Host ""
Write-Host "🔍 VERIFICANDO PROJETO..." -ForegroundColor Cyan
Write-Host ""

$erros = 0
$avisos = 0

# Função auxiliar
function Test-FileExists {
    param($path, $nome)
    if (Test-Path $path) {
        Write-Host "✅ $nome encontrado" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ $nome NÃO encontrado: $path" -ForegroundColor Red
        $script:erros++
        return $false
    }
}

function Test-FileNotExists {
    param($path, $nome)
    if (Test-Path $path) {
        Write-Host "⚠️  $nome ENCONTRADO (não deveria estar no Git)" -ForegroundColor Yellow
        $script:avisos++
        return $false
    } else {
        Write-Host "✅ $nome ausente (correto)" -ForegroundColor Green
        return $true
    }
}

# ==================================================
# VERIFICAR ARQUIVOS ESSENCIAIS
# ==================================================
Write-Host "📁 Verificando arquivos principais..." -ForegroundColor White
Write-Host ""

Test-FileExists "index.html" "index.html"
Test-FileExists "api-config.js" "api-config.js"
Test-FileExists "styles.css" "styles.css"
Test-FileExists ".gitignore" ".gitignore"
Test-FileExists "backend/server.js" "backend/server.js"
Test-FileExists "backend/package.json" "backend/package.json"
Test-FileExists "backend/database.sql" "backend/database.sql"
Test-FileExists "backend/.env.example" "backend/.env.example"

Write-Host ""

# ==================================================
# VERIFICAR PASTAS
# ==================================================
Write-Host "📂 Verificando pastas..." -ForegroundColor White
Write-Host ""

Test-FileExists "js" "Pasta js/"
Test-FileExists "css" "Pasta css/"
Test-FileExists "backend" "Pasta backend/"

Write-Host ""

# ==================================================
# VERIFICAR ARQUIVOS QUE NÃO DEVEM EXISTIR
# ==================================================
Write-Host "🔒 Verificando arquivos sensíveis..." -ForegroundColor White
Write-Host ""

Test-FileNotExists "backend/.env" ".env (arquivo sensível)"
Test-FileNotExists "backend/node_modules" "node_modules/ (muito pesado)"

Write-Host ""

# ==================================================
# VERIFICAR GIT
# ==================================================
Write-Host "🔧 Verificando Git..." -ForegroundColor White
Write-Host ""

try {
    $gitVersion = git --version 2>$null
    Write-Host "✅ Git instalado: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git NÃO instalado" -ForegroundColor Red
    Write-Host "   Baixe em: https://git-scm.com/download/win" -ForegroundColor Yellow
    $erros++
}

if (Test-Path ".git") {
    Write-Host "✅ Repositório Git inicializado" -ForegroundColor Green
} else {
    Write-Host "⚠️  Repositório Git NÃO inicializado" -ForegroundColor Yellow
    Write-Host "   Execute: .\setup-git.ps1" -ForegroundColor Yellow
    $avisos++
}

Write-Host ""

# ==================================================
# VERIFICAR NODE.JS
# ==================================================
Write-Host "🟢 Verificando Node.js..." -ForegroundColor White
Write-Host ""

try {
    $nodeVersion = node --version 2>$null
    Write-Host "✅ Node.js instalado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Node.js NÃO instalado" -ForegroundColor Yellow
    Write-Host "   Baixe em: https://nodejs.org/" -ForegroundColor Yellow
    $avisos++
}

try {
    $npmVersion = npm --version 2>$null
    Write-Host "✅ npm instalado: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  npm NÃO instalado" -ForegroundColor Yellow
    $avisos++
}

Write-Host ""

# ==================================================
# VERIFICAR MÓDULOS JAVASCRIPT
# ==================================================
Write-Host "📜 Verificando módulos JavaScript..." -ForegroundColor White
Write-Host ""

$modulosJS = @(
    "js/main.js",
    "js/auth.js",
    "js/cart.js",
    "js/products.js",
    "js/carousel.js"
)

foreach ($modulo in $modulosJS) {
    Test-FileExists $modulo $modulo
}

Write-Host ""

# ==================================================
# VERIFICAR TAMANHO DO PROJETO
# ==================================================
Write-Host "📊 Tamanho do projeto..." -ForegroundColor White
Write-Host ""

$tamanho = (Get-ChildItem -Recurse -File | 
    Where-Object { $_.FullName -notmatch "node_modules" } |
    Measure-Object -Property Length -Sum).Sum / 1MB

Write-Host ("   {0:N2} MB (sem node_modules)" -f $tamanho) -ForegroundColor Cyan

if ($tamanho -gt 100) {
    Write-Host "⚠️  Projeto muito grande (>100MB)" -ForegroundColor Yellow
    $avisos++
}

Write-Host ""

# ==================================================
# RESULTADO FINAL
# ==================================================
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "RESULTADO DA VERIFICAÇÃO" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host ""

if ($erros -eq 0 -and $avisos -eq 0) {
    Write-Host "🎉 PROJETO PERFEITO!" -ForegroundColor Green
    Write-Host "   Tudo está pronto para transferir via Git/GitHub" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 PRÓXIMO PASSO:" -ForegroundColor Cyan
    Write-Host "   1. Execute: .\setup-git.ps1" -ForegroundColor White
    Write-Host "   2. Crie repositório no GitHub" -ForegroundColor White
    Write-Host "   3. Faça push do código" -ForegroundColor White
} elseif ($erros -eq 0) {
    Write-Host "✅ Projeto BOM (apenas avisos)" -ForegroundColor Yellow
    Write-Host "   $avisos aviso(s) encontrado(s)" -ForegroundColor Yellow
    Write-Host "   Você pode prosseguir, mas verifique os avisos acima" -ForegroundColor Yellow
} else {
    Write-Host "❌ PROJETO COM PROBLEMAS" -ForegroundColor Red
    Write-Host "   $erros erro(s) encontrado(s)" -ForegroundColor Red
    Write-Host "   $avisos aviso(s) encontrado(s)" -ForegroundColor Yellow
    Write-Host "   Corrija os erros antes de transferir" -ForegroundColor Red
}

Write-Host ""
Write-Host "📖 Para ajuda, veja: GUIA_GITHUB.md ou TRANSFERIR.md" -ForegroundColor Cyan
Write-Host ""
