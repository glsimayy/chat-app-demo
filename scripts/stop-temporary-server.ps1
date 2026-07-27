[CmdletBinding()]
param(
    [switch]$StopStack
)

$ErrorActionPreference = "Stop"
$tunnelName = "ello-quick-tunnel"
$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker was not found."
}

$existingTunnel = docker ps `
    --all `
    --filter "name=^/$tunnelName$" `
    --format "{{.Names}}"

if ($existingTunnel -contains $tunnelName) {
    & docker rm --force $tunnelName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "The temporary tunnel could not be removed."
    }
    Write-Host "Temporary public access stopped." -ForegroundColor Green
} else {
    Write-Host "No temporary tunnel is currently defined."
}

if ($StopStack) {
    Set-Location $repoRoot
    & docker compose stop
    if ($LASTEXITCODE -ne 0) {
        throw "Docker services could not be stopped."
    }
    Write-Host "ellO Docker services stopped." -ForegroundColor Green
}
