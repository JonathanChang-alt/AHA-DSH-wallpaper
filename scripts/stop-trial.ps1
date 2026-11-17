$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$stateFile = Join-Path $projectRoot '.trial-state\server.json'
if (!(Test-Path -LiteralPath $stateFile)) { Write-Output 'No AHA trial process recorded.'; exit 0 }
$saved = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
$server = Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
if (!$server) { Write-Output 'AHA trial has already stopped.'; exit 0 }
$expectedHome = Join-Path $projectRoot '.trial-home'
if ($saved.home -ne $expectedHome -or $server.Path -ne $saved.executable -or $server.StartTime.ToUniversalTime().Ticks -ne ([datetime]$saved.startedAt).ToUniversalTime().Ticks) {
  throw 'Recorded process identity no longer matches. No process was stopped.'
}
# The PID, creation time, executable and isolated home must all match before
# stopping this owned process tree. No other DSH or browser process is touched.
& taskkill.exe /PID $server.Id /T /F
if ($LASTEXITCODE -ne 0) { throw 'Could not stop the verified trial process tree.' }
Write-Output 'AHA isolated trial stopped; its saved preferences remain available.'
