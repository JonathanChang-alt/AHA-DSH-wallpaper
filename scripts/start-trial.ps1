param(
  [ValidateRange(1,65535)][int]$Port = 19659,
  [string]$DshInstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness')
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$trialHome = Join-Path $projectRoot '.trial-home'
$stateDir = Join-Path $projectRoot '.trial-state'
$stateFile = Join-Path $stateDir 'server.json'
$exe = Join-Path $DshInstallDir 'DeepSeek Harness.exe'
$cli = Join-Path $DshInstallDir 'resources\runtime\cli\bin\dsh.cmd'
$cliEntry = Join-Path $DshInstallDir 'resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js'
if (!(Test-Path -LiteralPath $exe)) { throw "DSH installation not found: $DshInstallDir" }
if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'lib\client.js'))) { throw 'Run npm run build first.' }
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
if (Test-Path -LiteralPath $stateFile) {
  $saved = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
  $existing = Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
  if ($existing -and $existing.StartTime.ToUniversalTime().Ticks -eq ([datetime]$saved.startedAt).ToUniversalTime().Ticks -and $existing.Path -eq $saved.executable) {
    Write-Output "AHA isolated trial is already running: $($saved.url)"
    exit 0
  }
}
$oldDshHome = $env:DSH_HOME
$oldRunAsNode = $env:ELECTRON_RUN_AS_NODE
try {
  $env:DSH_HOME = $trialHome
  $env:ELECTRON_RUN_AS_NODE = '1'
  $profileManifest = Join-Path $trialHome 'profiles\aha-trial\package.json'
  if (!(Test-Path -LiteralPath $profileManifest)) {
    & $cli --profile aha-trial --from-default-profile web -- --help | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Failed to initialize isolated profile.' }
  }
  $manifest = Get-Content -LiteralPath $profileManifest -Raw -Encoding UTF8 | ConvertFrom-Json
  if (!$manifest.dependencies.'dsh-aha-theme') {
    & $cli plugin --profile aha-trial add $projectRoot --store-dir (Join-Path $stateDir 'pnpm-store') --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw 'Failed to install the local theme into isolated profile.' }
  }
  $stdout = Join-Path $stateDir 'server.stdout.log'
  $stderr = Join-Path $stateDir 'server.stderr.log'
  $arguments = @('--expose-internals', ('"' + $cliEntry + '"'), '--profile', 'aha-trial', '--', '--host', '127.0.0.1', '--port', "$Port", '--no-open')
  $server = Start-Process -FilePath $exe -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
  $url = "http://127.0.0.1:$Port"
  [ordered]@{
    pid = $server.Id
    startedAt = $server.StartTime.ToUniversalTime().ToString('o')
    executable = $exe
    home = $trialHome
    url = $url
  } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    $server.Refresh()
    if ($server.HasExited) { throw "Trial host exited. See $stderr" }
    try {
      $startLog = [string](Get-Content -LiteralPath $stdout -Raw -Encoding UTF8)
      $readyUrl = [regex]::Match($startLog, 'http://127\.0\.0\.1:\d+/\?token=[A-Za-z0-9_-]+').Value
      if (!$readyUrl) { continue }
      $response = Invoke-WebRequest -Uri $readyUrl -UseBasicParsing -TimeoutSec 1
      if ($response.StatusCode -eq 200) { Write-Output "AHA isolated trial ready: $url"; exit 0 }
    } catch [System.Net.WebException] { }
  }
  Write-Output "Trial host started. See logs in $stateDir. URL: $url"
} finally {
  $env:DSH_HOME = $oldDshHome
  $env:ELECTRON_RUN_AS_NODE = $oldRunAsNode
}
