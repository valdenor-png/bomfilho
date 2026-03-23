Param(
  [string]$BaseUrl = "http://localhost:3001",
  [string]$WebhookToken = "",
  [string]$DeliveryId = "QA-DELIVERY-001"
)

$ErrorActionPreference = "Stop"

$fixturesDir = Join-Path $PSScriptRoot "fixtures/delivery-tracking"
if (-not (Test-Path $fixturesDir)) {
  throw "Diretorio de fixtures nao encontrado: $fixturesDir"
}

$sequence = @(
  "01_pending_no_courier.json",
  "02_pickup_assigned_no_location.json",
  "03_in_transit_with_tracking.json",
  "04_near_with_pin.json",
  "05_delivered_with_proof.json",
  "06_delivered_without_proof.json",
  "07_canceled.json",
  "08_out_of_order_regression_attempt.json",
  "09_delay_update_no_tracking_url.json"
)

$headers = @{
  "Content-Type" = "application/json"
}
if ($WebhookToken.Trim().Length -gt 0) {
  $headers["x-uber-webhook-token"] = $WebhookToken
}

Write-Host "Executando fixtures Uber webhook em $BaseUrl" -ForegroundColor Cyan

foreach ($file in $sequence) {
  $path = Join-Path $fixturesDir $file
  if (-not (Test-Path $path)) {
    Write-Warning "Fixture ausente: $file"
    continue
  }

  $json = Get-Content -Raw -Path $path
  $json = $json.Replace("__DELIVERY_ID__", $DeliveryId)

  try {
    $response = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/webhooks/uber" -Headers $headers -Body $json
    Write-Host "OK  - $file" -ForegroundColor Green
  }
  catch {
    Write-Host "FAIL - $file" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor DarkRed
  }

  Start-Sleep -Milliseconds 350
}

Write-Host "Concluido. Agora valide a matriz em docs/QA_ENTREGA_TRACKING_FINAL.md" -ForegroundColor Yellow
