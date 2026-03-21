$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DaemonBinary = Join-Path $ScriptDir "codex_monitor_daemon.exe"
$DataDir = if ($env:DATA_DIR) { $env:DATA_DIR } else { Join-Path $ScriptDir "data" }
$ListenAddr = if ($env:LISTEN_ADDR) { $env:LISTEN_ADDR } else { "127.0.0.1:4732" }
$HttpListenAddr = if ($env:HTTP_LISTEN_ADDR) { $env:HTTP_LISTEN_ADDR } else { "" }
$Token = $env:CODEX_MONITOR_DAEMON_TOKEN

if (-not (Test-Path $DaemonBinary)) {
    Write-Error "Error: Daemon binary not found at $DaemonBinary"
    Write-Output "Please download the appropriate binary for your platform from GitHub Releases"
    exit 1
}

if (-not $Token) {
    Write-Error "Error: CODEX_MONITOR_DAEMON_TOKEN environment variable is not set"
    Write-Output "Usage: `$env:CODEX_MONITOR_DAEMON_TOKEN='your-secret-token'; .\start_daemon.ps1"
    exit 1
}

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

Write-Output "Starting Codex Monitor Daemon..."
Write-Output "  Binary: $DaemonBinary"
Write-Output "  Data directory: $DataDir"
Write-Output "  Listen address: $ListenAddr"
if ($HttpListenAddr) {
    Write-Output "  HTTP listen address: $HttpListenAddr"
}

$ArgsList = @(
    "--token", $Token,
    "--data-dir", $DataDir,
    "--listen", $ListenAddr
)

if ($HttpListenAddr) {
    $ArgsList += @("--http-listen", $HttpListenAddr)
}

& $DaemonBinary $ArgsList
