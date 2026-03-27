[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePrefix,

    [string]$Tag = "latest",

    [string]$Platform = "linux/amd64",

    [switch]$Push,

    [switch]$NoCache
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ImageRepository {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Prefix,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $trimmedPrefix = $Prefix.Trim().TrimEnd("/")
    if ([string]::IsNullOrWhiteSpace($trimmedPrefix)) {
        throw "ImagePrefix cannot be empty. Use a value like 'your-dockerhub-user' or 'ghcr.io/your-org'."
    }

    return "$trimmedPrefix/$Name"
}

function Invoke-DockerCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Write-Host ""
    Write-Host (("> docker ") + ($Arguments -join " ")) -ForegroundColor Cyan
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed with exit code $LASTEXITCODE."
    }
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$frontendPath = Join-Path $repoRoot "site"
$backendPath = Join-Path $repoRoot "server"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI was not found in PATH. Install Docker Desktop or make sure docker is available before running this script."
}

$frontendRepository = Get-ImageRepository -Prefix $ImagePrefix -Name "group-ironmen-tracker-frontend"
$backendRepository = Get-ImageRepository -Prefix $ImagePrefix -Name "group-ironmen-tracker-backend"

$images = @(
    @{
        Name = "frontend"
        Context = $frontendPath
        Reference = "$frontendRepository:$Tag"
    },
    @{
        Name = "backend"
        Context = $backendPath
        Reference = "$backendRepository:$Tag"
    }
)

foreach ($image in $images) {
    if (-not (Test-Path $image.Context)) {
        throw "Expected build context for $($image.Name) at '$($image.Context)', but it was not found."
    }

    $buildArguments = @("build", "--pull", "--tag", $image.Reference)
    if (-not [string]::IsNullOrWhiteSpace($Platform)) {
        $buildArguments += @("--platform", $Platform)
    }
    if ($NoCache) {
        $buildArguments += "--no-cache"
    }
    $buildArguments += $image.Context

    Invoke-DockerCommand -Arguments $buildArguments
}

if ($Push) {
    foreach ($image in $images) {
        Invoke-DockerCommand -Arguments @("push", $image.Reference)
    }
}

Write-Host ""
Write-Host "Build complete." -ForegroundColor Green
if ($Push) {
    Write-Host "Images were pushed successfully." -ForegroundColor Green
} else {
    Write-Host "Images were built locally only. Re-run with -Push after 'docker login' when you are ready to publish." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Use these values in your .env file:" -ForegroundColor Cyan
Write-Host "FRONTEND_IMAGE=$frontendRepository"
Write-Host "BACKEND_IMAGE=$backendRepository"
Write-Host "IMAGE_TAG=$Tag"

Write-Host ""
Write-Host "Then run 'docker compose up -d' to start the stack with your images." -ForegroundColor Cyan
