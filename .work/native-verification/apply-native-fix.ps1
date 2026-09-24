$ErrorActionPreference = 'Stop'
$nativeTarget = [IO.Path]::GetFullPath('C:/Users/Ari/Documents/MotoLock_Native')
$stageRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'project'))
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'apply-manifest.json') -Raw | ConvertFrom-Json
$nativePrefix = $nativeTarget.TrimEnd('\') + '\'
foreach ($item in $manifest) {
    $targetPath = [IO.Path]::GetFullPath((Join-Path $nativeTarget $item.path))
    if (-not $targetPath.StartsWith($nativePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Target outside native project' }
    if ($item.originalHash) {
        if (-not (Test-Path -LiteralPath $targetPath)) { throw "Original file missing: $($item.path)" }
        if ((Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash -ne $item.originalHash) { throw "File changed since review: $($item.path)" }
    } elseif (Test-Path -LiteralPath $targetPath) { throw "New file already exists: $($item.path)" }
    if (-not $item.remove) {
        $sourcePath = Join-Path $stageRoot $item.path
        if ((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne $item.stagedHash) { throw "Staged file changed: $($item.path)" }
    }
}
$backupRoot = Join-Path $nativeTarget ('verification-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not ([IO.Path]::GetFullPath($backupRoot)).StartsWith($nativePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid backup path' }
New-Item -ItemType Directory -Path $backupRoot | Out-Null
foreach ($item in $manifest) {
    $targetPath = Join-Path $nativeTarget $item.path
    if (Test-Path -LiteralPath $targetPath) {
        $backupPath = Join-Path $backupRoot $item.path
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupPath) | Out-Null
        Copy-Item -LiteralPath $targetPath -Destination $backupPath
    }
}
foreach ($item in $manifest) {
    $targetPath = Join-Path $nativeTarget $item.path
    if ($item.remove) { Remove-Item -LiteralPath $targetPath }
    else {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetPath) | Out-Null
        Copy-Item -LiteralPath (Join-Path $stageRoot $item.path) -Destination $targetPath -Force
        if ((Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash -ne $item.stagedHash) { throw "Copy verification failed: $($item.path)" }
    }
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'apply-manifest.json') -Destination (Join-Path $backupRoot 'change-manifest.json')
Write-Output "Applied $($manifest.Count) native source changes. Backup: $backupRoot"
