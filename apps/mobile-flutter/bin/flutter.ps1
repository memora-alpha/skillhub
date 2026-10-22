$shimDir = (Resolve-Path (Split-Path -Parent $PSCommandPath)).Path.TrimEnd('\')
$segments = @(
  foreach ($segment in ($env:PATH -split ';')) {
    $item = $segment.Trim().Trim('"')
    if (-not $item) { continue }
    if ($item.TrimEnd('\') -eq $shimDir) { continue }
    if ($item -match 'WindowsApps') { continue }
    $item
  }
)
$realDir = $null
foreach ($dir in $segments) {
  if ($dir -notmatch '^[A-Za-z]:\\') { continue }
  if (Test-Path -LiteralPath (Join-Path $dir 'flutter.bat')) {
    $realDir = $dir
    break
  }
}
if (-not $realDir) {
  Write-Error 'Khong tim thay Flutter SDK.'
  exit 1
}
$env:PATH = $segments -join ';'

function In-SkillHubMobile {
  $dir = (Get-Location).Path
  for ($i = 0; $i -lt 5 -and $dir; $i++) {
    $pubspec = Join-Path $dir 'pubspec.yaml'
    if (Test-Path $pubspec) {
      $head = Get-Content $pubspec -TotalCount 1
      if ($head -match '^name:\s*skillhub_mobile\s*$') { return $true }
    }
    $parent = Split-Path $dir -Parent
    if (-not $parent -or $parent -eq $dir) { break }
    $dir = $parent
  }
  return $false
}

$forward = @($args)
if ($forward.Count -ge 1 -and $forward[0] -eq 'run' -and (In-SkillHubMobile)) {
  $device = $null
  $hasPort = $false
  $hasHost = $false
  for ($i = 0; $i -lt $forward.Count; $i++) {
    $item = [string]$forward[$i]
    if ($item -eq '-d' -or $item -eq '--device-id') {
      if ($i + 1 -lt $forward.Count) { $device = [string]$forward[$i + 1] }
    } elseif ($item.StartsWith('--device-id=')) {
      $device = $item.Substring(12)
    }
    if ($item -eq '--web-port' -or $item.StartsWith('--web-port=')) { $hasPort = $true }
    if ($item -eq '--web-hostname' -or $item.StartsWith('--web-hostname=')) { $hasHost = $true }
  }
  $webDevice = -not $device -or $device -in @('web-server', 'chrome', 'edge')
  if (-not $device) { $forward += @('-d', 'web-server') }
  if ($webDevice -and -not $hasHost) { $forward += @('--web-hostname', 'localhost') }
  if ($webDevice -and -not $hasPort) { $forward += @('--web-port', '3000') }
}

& (Join-Path $realDir 'flutter.bat') @forward
exit $LASTEXITCODE
