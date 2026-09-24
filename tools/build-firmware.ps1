param(
    [string]$ArduinoCli = 'arduino-cli',
    [string]$ConfigFile = ''
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$buildRoot = Join-Path $repoRoot 'build\firmware'
$configArgs = @()
if ($ConfigFile) { $configArgs = @('--config-file', (Resolve-Path -LiteralPath $ConfigFile).Path) }
foreach ($name in @('MotoLock_Helmet_ESP32_NoLED', 'MotoLock_Motor_ESP32_v2')) {
    $sketch = Join-Path $buildRoot $name
    New-Item -ItemType Directory -Force -Path $sketch | Out-Null
    Copy-Item -LiteralPath (Join-Path $repoRoot ($name + '.ino')) -Destination $sketch
    Copy-Item -LiteralPath (Join-Path $repoRoot 'MotoLockProtocol.h') -Destination $sketch
    & $ArduinoCli compile @configArgs --fqbn 'esp32:esp32:esp32:PartitionScheme=huge_app' --build-path (Join-Path $sketch 'output') $sketch
    if ($LASTEXITCODE -ne 0) { throw "Firmware build failed: $name" }
}
