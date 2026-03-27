param(
  [string]$BaseUrl = "http://localhost:3100",
  [int]$Port = 3100,
  [string]$RepositoryDriver = "memory",
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

function Get-RouteWithRetry {
  param(
    [string]$ApiBaseUrl,
    [string]$OrderId,
    [int]$MaxAttempts = 20,
    [int]$SleepMs = 500
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      return Invoke-RestMethod -Uri "$ApiBaseUrl/api/v1/orders/$OrderId/route" -Method Get
    }
    catch {
      if ($attempt -eq $MaxAttempts) {
        throw
      }
      Start-Sleep -Milliseconds $SleepMs
    }
  }

  throw "Route was not available after retries"
}

try {
  if (-not $UseExistingServer) {
    $queueDriver = $env:QUEUE_DRIVER
    if ([string]::IsNullOrWhiteSpace($queueDriver)) {
      $queueDriver = "in-memory"
    }

    $repoDriver = $RepositoryDriver
    if ([string]::IsNullOrWhiteSpace($repoDriver)) {
      $repoDriver = $env:REPOSITORY_DRIVER
    }
    if ([string]::IsNullOrWhiteSpace($repoDriver)) {
      $repoDriver = "memory"
    }

    $serverJob = Start-Job -ScriptBlock {
      param($repo, $port, $driver, $repoDriver)
      Set-Location $repo
      $env:ORDER_API_PORT = [string]$port
      $env:QUEUE_DRIVER = $driver
      $env:FORCE_REPOSITORY_DRIVER = $repoDriver
      bun run dev
    } -ArgumentList $repoRoot, $Port, $queueDriver, $repoDriver

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

  $userRoutes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/users/usr_e2e/routes" -Method Get
  Assert-True ($userRoutes.count -ge 1) "user routes endpoint returned no orders"

  $route = Get-RouteWithRetry -ApiBaseUrl $BaseUrl -OrderId $orderId
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
    userRoutesCount = $userRoutes.count
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
