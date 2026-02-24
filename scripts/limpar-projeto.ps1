# ============================================
# LIMPEZA E ORGANIZAÇÃO DO PROJETO
# Remove arquivos desnecessários
# ============================================

Write-Host ""
Write-Host "🧹 LIMPANDO PROJETO..." -ForegroundColor Cyan
Write-Host ""

$arquivosParaRemover = @(
    "script.js",           # Obsoleto, substituído por módulos
    "README_NOVO.md",      # Duplicado
    "teste-conexao.html"   # Apenas debug
)

$arquivosParaMover = @(
    "GUIA_GITHUB.md",
    "TRANSFERIR.md", 
    "CONTEXTO_PROJETO.md",
    "GUIA_TESTES.md",
    "EXEMPLOS_API.md",
    "FUNCIONALIDADES.md",
    "ATUALIZAR_BD.md",
    "SOLUCAO-PROBLEMAS.md",
    "MELHORIAS_1-2-3.md",
    "TESTES.md"
)

# Criar pasta docs/ se não existir
if (-not (Test-Path "docs")) {
    New-Item -ItemType Directory -Path "docs" | Out-Null
    Write-Host "📁 Criada pasta docs/" -ForegroundColor Green
}

# Remover arquivos obsoletos
Write-Host "🗑️  Removendo arquivos obsoletos..." -ForegroundColor Yellow
foreach ($arquivo in $arquivosParaRemover) {
    if (Test-Path $arquivo) {
        $tamanho = (Get-Item $arquivo).Length / 1KB
        Remove-Item $arquivo -Force
        Write-Host "   ❌ $arquivo ($([math]::Round($tamanho, 2)) KB)" -ForegroundColor Red
    }
}

Write-Host ""

# Mover documentação para docs/
Write-Host "📦 Organizando documentação..." -ForegroundColor Yellow
foreach ($arquivo in $arquivosParaMover) {
    if (Test-Path $arquivo) {
        Move-Item $arquivo "docs/" -Force
        Write-Host "   📄 $arquivo → docs/" -ForegroundColor Cyan
    }
}

# Mover scripts para pasta scripts/
Write-Host ""
Write-Host "📦 Organizando scripts..." -ForegroundColor Yellow

if (-not (Test-Path "scripts")) {
    New-Item -ItemType Directory -Path "scripts" | Out-Null
    Write-Host "📁 Criada pasta scripts/" -ForegroundColor Green
}

$scripts = @("setup-git.ps1", "setup-git.bat", "verificar-projeto.ps1")
foreach ($script in $scripts) {
    if (Test-Path $script) {
        Move-Item $script "scripts/" -Force
        Write-Host "   📜 $script → scripts/" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "=" * 50 -ForegroundColor Green
Write-Host "✅ LIMPEZA CONCLUÍDA!" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Green
Write-Host ""

Write-Host "📊 ESTRUTURA FINAL:" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 Raiz (arquivos principais):" -ForegroundColor White
Write-Host "   - index.html" -ForegroundColor Gray
Write-Host "   - admin.html" -ForegroundColor Gray
Write-Host "   - api-config.js" -ForegroundColor Gray
Write-Host "   - styles.css" -ForegroundColor Gray
Write-Host "   - README.md" -ForegroundColor Gray
Write-Host "   - .gitignore" -ForegroundColor Gray
Write-Host ""
Write-Host "📁 Pastas:" -ForegroundColor White
Write-Host "   - backend/     (API e banco de dados)" -ForegroundColor Gray
Write-Host "   - js/          (módulos JavaScript)" -ForegroundColor Gray
Write-Host "   - css/         (estilos)" -ForegroundColor Gray
Write-Host "   - docs/        (documentação)" -ForegroundColor Gray
Write-Host "   - scripts/     (scripts auxiliares)" -ForegroundColor Gray
Write-Host ""

$tamanhoRaiz = (Get-ChildItem -File | Measure-Object -Property Length -Sum).Sum / 1KB
Write-Host ("💾 Tamanho na raiz: {0:N2} KB" -f $tamanhoRaiz) -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ Projeto muito mais limpo e organizado!" -ForegroundColor Green
Write-Host ""
