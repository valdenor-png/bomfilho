# ============================================
# VERIFICADOR DE PROJETO
# Verifica se a estrutura minima esta correta
# ============================================

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host ''
Write-Host 'VERIFYING PROJECT STRUCTURE...' -ForegroundColor Cyan
Write-Host ''

$errors = 0
$warnings = 0

function Test-FileExists {
    param([string]$Path, [string]$Name)

    if (Test-Path $Path) {
        Write-Host "OK: $Name" -ForegroundColor Green
        return $true
    }

    Write-Host "ERROR: $Name not found -> $Path" -ForegroundColor Red
    $script:errors++
    return $false
}

function Test-FileNotExists {
    param([string]$Path, [string]$Name)

    if (Test-Path $Path) {
        Write-Host "WARN: $Name found (should not be in repository)" -ForegroundColor Yellow
        $script:warnings++
        return $false
    }

    Write-Host "OK: $Name absent" -ForegroundColor Green
    return $true
}

Write-Host 'Checking core files...' -ForegroundColor White
Write-Host ''

Test-FileExists '.gitignore' '.gitignore'
Test-FileExists 'README.md' 'README.md'
Test-FileExists 'backend/server.js' 'backend/server.js'
Test-FileExists 'backend/package.json' 'backend/package.json'
Test-FileExists 'backend/database.sql' 'backend/database.sql'
Test-FileExists 'backend/.env.example' 'backend/.env.example'
Test-FileExists 'frontend-react/package.json' 'frontend-react/package.json'
Test-FileExists 'frontend-react/src/main.jsx' 'frontend-react/src/main.jsx'
Test-FileExists 'legacy/index.html' 'legacy/index.html'

Write-Host ''
Write-Host 'Checking folders...' -ForegroundColor White
Write-Host ''

Test-FileExists 'backend' 'backend folder'
Test-FileExists 'frontend-react' 'frontend-react folder'
Test-FileExists 'legacy' 'legacy folder'
Test-FileExists 'docs' 'docs folder'
Test-FileExists 'scripts' 'scripts folder'

Write-Host ''
Write-Host 'Checking sensitive artifacts...' -ForegroundColor White
Write-Host ''

Test-FileNotExists 'backend/.env' 'backend/.env'
Test-FileNotExists 'backend/node_modules' 'backend/node_modules'

Write-Host ''
Write-Host 'Checking git and node...' -ForegroundColor White
Write-Host ''

try {
    $gitVersion = git --version 2>$null
    Write-Host "OK: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host 'WARN: git is not installed' -ForegroundColor Yellow
    $warnings++
}

try {
    $nodeVersion = node --version 2>$null
    Write-Host "OK: Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host 'WARN: Node.js is not installed' -ForegroundColor Yellow
    $warnings++
}

try {
    $npmVersion = npm --version 2>$null
    Write-Host "OK: npm v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host 'WARN: npm is not installed' -ForegroundColor Yellow
    $warnings++
}

Write-Host ''
Write-Host 'Checking legacy key modules...' -ForegroundColor White
Write-Host ''

$legacyModules = @(
    'legacy/js/main.js',
    'legacy/js/auth.js',
    'legacy/js/cart.js',
    'legacy/js/products.js',
    'legacy/js/carousel.js'
)

foreach ($module in $legacyModules) {
    Test-FileExists $module $module
}

Write-Host ''
Write-Host 'Project size...' -ForegroundColor White
Write-Host ''

$sizeMB = (Get-ChildItem -Recurse -File |
    Where-Object { $_.FullName -notmatch 'node_modules' } |
    Measure-Object -Property Length -Sum).Sum / 1MB

Write-Host ('{0:N2} MB (without node_modules)' -f $sizeMB) -ForegroundColor Cyan

if ($sizeMB -gt 100) {
    Write-Host 'WARN: project is larger than 100MB' -ForegroundColor Yellow
    $warnings++
}

Write-Host ''
Write-Host ('=' * 50) -ForegroundColor Cyan
Write-Host 'VERIFICATION RESULT' -ForegroundColor Cyan
Write-Host ('=' * 50) -ForegroundColor Cyan
Write-Host ''

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host 'STATUS: PERFECT' -ForegroundColor Green
} elseif ($errors -eq 0) {
    Write-Host "STATUS: GOOD WITH WARNINGS ($warnings)" -ForegroundColor Yellow
} else {
    Write-Host "STATUS: FAIL - ERRORS: $errors, WARNINGS: $warnings" -ForegroundColor Red
}

Write-Host ''
