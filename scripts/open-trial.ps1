$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$stateFile = Join-Path $projectRoot '.trial-state\server.json'
if (!(Test-Path -LiteralPath $stateFile)) { throw 'Start the isolated preview with npm run trial first.' }
$saved = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
$server = Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
if (!$server -or $server.Path -ne $saved.executable -or $server.StartTime.ToUniversalTime().Ticks -ne ([datetime]$saved.startedAt).ToUniversalTime().Ticks) { throw 'The isolated preview is no longer running.' }
# The loopback access token stays in the ignored local log and is never printed.
$log = Get-Content -LiteralPath (Join-Path $projectRoot '.trial-state\server.stdout.log') -Raw -Encoding UTF8
$url = [regex]::Match($log, 'http://127\.0\.0\.1:\d+/\?token=[A-Za-z0-9_-]+').Value
if (!$url -or !($url.StartsWith($saved.url + '/?token='))) { throw 'No matching local preview URL is available.' }
Start-Process $url
Write-Output 'Opened the AHA isolated preview in your browser.'
