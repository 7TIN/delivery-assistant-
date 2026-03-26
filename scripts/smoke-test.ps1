param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$Port = 3000,
  [switch]$UseExistingServer
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverJob = $null

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw "Assertion failed: $Message"
  }
}

try {
  if (-not $UseExistingServer) {
    $queueDriver = $env:QUEUE_DRIVER
    if ([string]::IsNullOrWhiteSpace($queueDriver)) {
      $queueDriver = "in-memory"
    }

    $graphHopperKey = $env:GRAPH_HOPPER_API_KEY

    $serverJob = Start-Job -ScriptBlock {
      param($repo, $port, $driver, $graphKey)
      Set-Location $repo
      $env:ORDER_API_PORT = [string]$port
      $env:QUEUE_DRIVER = $driver
      if (-not [string]::IsNullOrWhiteSpace($graphKey)) {
        $env:GRAPH_HOPPER_API_KEY = $graphKey
      }
      bun run dev
    } -ArgumentList $repoRoot, $Port, $queueDriver, $graphHopperKey

    Start-Sleep -Seconds 3
  }

  $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
  Assert-True ($health.status -eq "ok") "health endpoint did not return ok"

  $orderPayload = @{
    userId = "usr_e2e"
    deliveryLocation = @{ lat = 12.9716; lng = 77.5946; address = "Bengaluru" }
    items = @(
      @{ itemId = "milk"; name = "Milk"; category = "grocery"; merchantId = "grocery_1"; quantity = 2 },
      @{ itemId = "pizza"; name = "Pizza"; category = "food"; merchantId = "food_1"; quantity = 1 },
      @{ itemId = "charger"; name = "Charger"; category = "electronics"; merchantId = "electronics_1"; quantity = 1 }
    )
  } | ConvertTo-Json -Depth 10

  $order = Invoke-RestMethod -Uri "$BaseUrl/api/v1/orders" -Method Post -Body $orderPayload -ContentType "application/json"
  Assert-True (-not [string]::IsNullOrWhiteSpace($order.orderId)) "orderId was not returned"

  $orderId = $order.orderId
  $snapshot = Invoke-RestMethod -Uri "$BaseUrl/api/v1/orders/$orderId" -Method Get
  Assert-True ($snapshot.order.id -eq $orderId) "snapshot order id mismatch"

  $route = Invoke-RestMethod -Uri "$BaseUrl/api/v1/orders/$orderId/route" -Method Get
  Assert-True ($route.stops.Count -ge 1) "route contains no stops"

  $cancel = Invoke-RestMethod -Uri "$BaseUrl/api/v1/orders/$orderId/cancel" -Method Post
  Assert-True ($cancel.status -eq "canceled") "cancel endpoint did not return canceled"

  $result = [PSCustomObject]@{
    healthStatus = $health.status
    orderId = $orderId
    orderStatusAfterCreate = $order.status
    snapshotStatus = $snapshot.order.status
    routeVersion = $route.version
    routeStops = $route.stops.Count
    cancelStatus = $cancel.status
  }

  Write-Host "Smoke test PASSED" -ForegroundColor Green
  $result | ConvertTo-Json -Depth 10
}
finally {
  if ($serverJob) {
    Stop-Job -Job $serverJob -ErrorAction SilentlyContinue | Out-Null
    Receive-Job -Job $serverJob -ErrorAction SilentlyContinue | Out-Null
    Remove-Job -Job $serverJob -ErrorAction SilentlyContinue | Out-Null
  }
}
