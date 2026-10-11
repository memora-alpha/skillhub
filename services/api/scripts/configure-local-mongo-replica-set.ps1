param(
    [switch]$Apply,
    [ValidatePattern('^[A-Za-z][A-Za-z0-9_-]{0,31}$')]
    [string]$ReplicaSetName = 'rs0'
)

$ErrorActionPreference = 'Stop'
# Discover the installed Windows service; do not replace its data path or network settings.
$mongoService = Get-CimInstance Win32_Service -Filter "Name='MongoDB'"
if (-not $mongoService) { throw 'MongoDB service not found.' }
$configMatch = [regex]::Match($mongoService.PathName, '--config\s+"([^"]+)"')
if (-not $configMatch.Success) { throw 'Expected a quoted MongoDB service config path.' }
$configPath = (Resolve-Path -LiteralPath $configMatch.Groups[1].Value).Path
$original = [IO.File]::ReadAllText($configPath)
if ($original -notmatch '(?m)^\s+bindIp:\s*(127\.0\.0\.1|localhost)\s*$') {
    throw 'This helper requires MongoDB bound only to loopback.'
}
if ($original -match '(?m)^replication:') {
    if ($original -notmatch "(?m)^\s+replSetName:\s*['`"]?$([regex]::Escape($ReplicaSetName))['`"]?\s*$") {
        throw 'Existing replication settings differ; review manually.'
    }
    $updated = $original
} elseif ($original -match '(?m)^#replication:[ \t]*\r?$') {
    $updated = [regex]::Replace($original, '(?m)^#replication:[ \t]*\r?$', "replication:`r`n  replSetName: $ReplicaSetName")
} else {
    $updated = $original.TrimEnd() + "`r`n`r`nreplication:`r`n  replSetName: $ReplicaSetName`r`n"
}

Write-Output "Service: MongoDB; config: $configPath"
Write-Output "Proposed replication.replSetName: $ReplicaSetName; data path, port and bindIp preserved."
if (-not $Apply) { Write-Output 'Preview only. Use -Apply from Administrator PowerShell.'; exit 0 }
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Windows Administrator privileges required before changing service/config.'
}
if ($updated -eq $original) { Write-Output 'Replication config already matches; no restart performed.'; exit 0 }
if ($mongoService.State -ne 'Running') { throw 'Expected running MongoDB service before conversion.' }

$backupPath = $configPath + '.before-replica-' + (Get-Date -Format 'yyyyMMdd-HHmmssfff') + '.bak'
Copy-Item -LiteralPath $configPath -Destination $backupPath -ErrorAction Stop
Write-Output "Config backup: $backupPath"
try {
    Stop-Service -Name MongoDB -ErrorAction Stop
    (Get-Service -Name MongoDB).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
    [IO.File]::WriteAllText($configPath, $updated, [Text.UTF8Encoding]::new($false))
    Start-Service -Name MongoDB -ErrorAction Stop
    (Get-Service -Name MongoDB).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
    Write-Output 'MongoDB service running with replica-set configuration; initialization remains a separate step.'
} catch {
    # Roll back config and restore the original service after a failed restart.
    $conversionError = $_
    if ((Get-Service -Name MongoDB).Status -eq 'Running') { Stop-Service -Name MongoDB }
    [IO.File]::WriteAllText($configPath, $original, [Text.UTF8Encoding]::new($false))
    Start-Service -Name MongoDB -ErrorAction Stop
    throw $conversionError
}
