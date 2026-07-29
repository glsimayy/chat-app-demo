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

function Wait-ForPublicTunnel {
    param(
        [string]$PublicUrl,
        [int]$TimeoutSeconds
    )

    if (-not (Get-Command Resolve-DnsName -ErrorAction SilentlyContinue)) {
        Write-Warning "Public DNS readiness could not be checked on this system."
        return
    }

    if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
        Write-Warning "Public tunnel health could not be checked because curl.exe is unavailable."
        return
    }

    $hostName = ([Uri]$PublicUrl).DnsSafeHost
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    Write-Host "Waiting for the public URL to become reachable..."
    while ((Get-Date) -lt $deadline) {
        try {
            $record = Resolve-DnsName `
                -Name $hostName `
                -Server "1.1.1.1" `
                -Type A `
                -ErrorAction Stop |
                Where-Object { $_.IPAddress } |
                Select-Object -First 1

            if ($record.IPAddress) {
                & curl.exe `
                    --silent `
                    --show-error `
                    --fail `
                    --max-time 10 `
                    --resolve "$($hostName):443:$($record.IPAddress)" `
                    "$PublicUrl/healthz" *> $null

                if ($LASTEXITCODE -eq 0) {
                    return
                }
            }
        } catch {
            # Quick-tunnel DNS records commonly need a few seconds to propagate.
        }

        Start-Sleep -Seconds 2
    }

    throw "Cloudflare created a URL, but it did not become reachable within $TimeoutSeconds seconds."
}

function Test-SystemDns {
    param([string]$PublicUrl)

    if (-not (Get-Command Resolve-DnsName -ErrorAction SilentlyContinue)) {
        return $true
    }

    try {
        Resolve-DnsName `
            -Name ([Uri]$PublicUrl).DnsSafeHost `
            -Type A `
            -ErrorAction Stop *> $null
        return $true
    } catch {
        return $false
    }
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
Wait-ForPublicTunnel `
    -PublicUrl $publicUrl `
    -TimeoutSeconds $WaitSeconds

Write-Host ""
Write-Host "ellO is ready." -ForegroundColor Green
Write-Host "Local:  http://localhost:5173"
Write-Host "Public: $publicUrl" -ForegroundColor Cyan
if (-not (Test-SystemDns -PublicUrl $publicUrl)) {
    Write-Warning "The tunnel is live, but Windows DNS still has the earlier NXDOMAIN response cached."
    Write-Host "Wait briefly or enable Secure DNS (Cloudflare 1.1.1.1) in the browser before opening the link."
}
Write-Host ""
Write-Host "The public URL is temporary. Stop it with:"
Write-Host "npm.cmd run server:temporary:stop"
