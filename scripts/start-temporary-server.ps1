[CmdletBinding()]
param(
    [switch]$Build,
    [ValidateRange(30, 300)]
    [int]$WaitSeconds = 120
)

$ErrorActionPreference = "Stop"
$tunnelName = "ello-quick-tunnel"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Docker {
    param([Parameter(Mandatory)][string[]]$Arguments)

    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed: docker $($Arguments -join ' ')"
    }
}

function Wait-ForFrontend {
    param([int]$TimeoutSeconds)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest `
                -Uri "http://127.0.0.1:5173/healthz" `
                -UseBasicParsing `
                -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                return
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }

    throw "Frontend did not become healthy within $TimeoutSeconds seconds."
}

function Wait-ForTunnelUrl {
    param(
        [string]$ContainerName,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $previousErrorActionPreference = $ErrorActionPreference
        try {
            # cloudflared writes normal informational logs to stderr. Windows
            # PowerShell otherwise promotes those lines to terminating errors.
            $ErrorActionPreference = "Continue"
            $logs = docker logs $ContainerName 2>&1 | Out-String
            $logsExitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        if ($logsExitCode -ne 0) {
            throw "Cloudflare tunnel logs could not be read."
        }

        $match = [regex]::Match(
            $logs,
            "https://[a-z0-9-]+\.trycloudflare\.com",
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
        if ($match.Success) {
            return $match.Value
        }

        $running = docker inspect `
            --format "{{.State.Running}}" `
            $ContainerName 2>$null
        if ($LASTEXITCODE -ne 0 -or $running.Trim() -ne "true") {
            throw "Cloudflare tunnel container stopped before producing a URL."
        }

        Start-Sleep -Seconds 2
    }

    throw "Cloudflare did not provide a public URL within $TimeoutSeconds seconds."
}

Set-Location $repoRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker was not found. Install and start Docker Desktop first."
}

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot ".env"))) {
    throw "Root .env file is missing. Create it from .env.compose.example first."
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Engine is not running. Start Docker Desktop and wait for Engine running."
}

Invoke-Docker -Arguments @("compose", "config", "--quiet")

$composeArguments = @("compose", "up", "-d")
if ($Build) {
    $composeArguments += "--build"
}

Write-Host "Starting ellO Docker services..."
Invoke-Docker -Arguments $composeArguments
Wait-ForFrontend -TimeoutSeconds $WaitSeconds

$existingTunnel = docker ps `
    --all `
    --filter "name=^/$tunnelName$" `
    --format "{{.Names}}"
if ($existingTunnel -contains $tunnelName) {
    Write-Host "Removing the previous temporary tunnel..."
    Invoke-Docker -Arguments @("rm", "--force", $tunnelName)
}

Write-Host "Starting a temporary Cloudflare tunnel..."
Invoke-Docker -Arguments @(
    "run",
    "--detach",
    "--name",
    $tunnelName,
    "cloudflare/cloudflared:latest",
    "tunnel",
    "--no-autoupdate",
    "--url",
    "http://host.docker.internal:5173"
)

$publicUrl = Wait-ForTunnelUrl `
    -ContainerName $tunnelName `
    -TimeoutSeconds $WaitSeconds

Write-Host ""
Write-Host "ellO is ready." -ForegroundColor Green
Write-Host "Local:  http://localhost:5173"
Write-Host "Public: $publicUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "The public URL is temporary. Stop it with:"
Write-Host "npm.cmd run server:temporary:stop"
