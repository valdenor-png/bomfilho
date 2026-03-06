# ============================================
# SCRIPT DE INICIALIZAÇÃO - GIT SETUP
# ============================================
# Este script prepara o projeto para Git/GitHub

Write-Host "🚀 Configurando projeto para Git..." -ForegroundColor Cyan
Write-Host ""

# Verificar se Git está instalado
try {
    $gitVersion = git --version
    Write-Host "✅ Git encontrado: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git não está instalado!" -ForegroundColor Red
    Write-Host "   Baixe em: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Verificar se já é um repositório Git
if (Test-Path ".git") {
    Write-Host "⚠️  Este projeto já é um repositório Git" -ForegroundColor Yellow
    $resposta = Read-Host "Deseja reinicializar? (s/N)"
    if ($resposta -ne "s") {
        Write-Host "Operação cancelada." -ForegroundColor Yellow
        exit 0
    }
    Remove-Item -Recurse -Force ".git"
}

# Inicializar Git
Write-Host ""
Write-Host "📦 Inicializando repositório Git..." -ForegroundColor Cyan
git init
git branch -M main

# Adicionar todos os arquivos
Write-Host "📝 Adicionando arquivos ao Git..." -ForegroundColor Cyan
git add .

# Fazer commit inicial
Write-Host "💾 Criando commit inicial..." -ForegroundColor Cyan
git commit -m "feat: Projeto inicial - Bom Filho Supermercado

- Sistema completo de e-commerce
- Frontend responsivo com carrinho de compras
- Backend API REST com Node.js
- Banco de dados MySQL
- Autenticação JWT
- Sistema de cupons e ofertas
- Painel administrativo
- Integração Mercado Pago"

Write-Host ""
Write-Host "✅ Repositório Git configurado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Criar repositório no GitHub:" -ForegroundColor White
Write-Host "   → Acesse: https://github.com/new" -ForegroundColor Gray
Write-Host "   → Nome: bom-filho-supermercado" -ForegroundColor Gray
Write-Host "   → Visibilidade: Private (recomendado)" -ForegroundColor Gray
Write-Host ""

Write-Host "2️⃣  Conectar ao GitHub (substitua SEU_USUARIO):" -ForegroundColor White
Write-Host "   git remote add origin https://github.com/SEU_USUARIO/bom-filho-supermercado.git" -ForegroundColor Yellow
Write-Host ""

Write-Host "3️⃣  Enviar código:" -ForegroundColor White
Write-Host "   git push -u origin main" -ForegroundColor Yellow
Write-Host ""

Write-Host "💡 Dica: Se pedir senha, use um Personal Access Token" -ForegroundColor Cyan
Write-Host "   Crie em: Settings → Developer settings → Personal access tokens" -ForegroundColor Gray
Write-Host ""

Write-Host "📖 Para mais detalhes, veja: GUIA_GITHUB.md" -ForegroundColor Cyan
Write-Host ""

# Mostrar status
Write-Host "📊 Status atual:" -ForegroundColor Cyan
git log --oneline -n 1
Write-Host ""
git status
