<#
.SYNOPSIS
  Full OSRS cache update pipeline: download cache, export all data, sync to site, update equipment, and optionally push.

.DESCRIPTION
  Orchestrates the entire cache update process:
    1. Install cache dependencies (npm ci)
    2. Run cache/update.js with site sync enabled (downloads cache, dumps items/images/maps/sprites/collection log, copies to site/)
    3. Update equipment.json from the latest dump's item-data
    4. Build the site frontend bundle
    5. Optionally git commit and push all changes

.PARAMETER SkipCacheDump
  Skip the cache download + export step (useful if you already have a recent dump and just want to re-sync).

.PARAMETER SkipEquipment
  Skip the equipment.json import step.

.PARAMETER SkipBuild
  Skip the site build step.

.PARAMETER Push
  After a successful update, stage all changes, commit, and push.

.PARAMETER CommitMessage
  Custom commit message. Defaults to "Update OSRS cache data YYYY-MM-DD".

.PARAMETER CachePath
  Override the OSRS cache source path (local jagexcache directory). If not set, update.js will auto-detect local cache or download from openrs2.org.

.PARAMETER DumpDir
  Override the dump output directory. If not set, update.js creates a timestamped directory under cache/dumps/.

.EXAMPLE
  .\scripts\update-cache.ps1
  # Full update: dump cache, sync site, update equipment, build

.EXAMPLE
  .\scripts\update-cache.ps1 -Push
  # Full update then git commit + push

.EXAMPLE
  .\scripts\update-cache.ps1 -SkipCacheDump -Push
  # Re-import equipment from latest existing dump and push
#>
[CmdletBinding()]
param(
    [switch]$SkipCacheDump,
    [switch]$SkipEquipment,
    [switch]$SkipBuild,
    [switch]$Push,
    [string]$CommitMessage,
    [string]$CachePath,
    [string]$DumpDir
)

$ErrorActionPreference = 'Stop'
# Resolve group-ironmen root: this script lives in group-ironmen/scripts/
$scriptsDir = $PSScriptRoot
$rootDir = Split-Path -Parent $scriptsDir
$cacheDir = Join-Path $rootDir 'cache'
$siteDir = Join-Path $rootDir 'site'

function Write-Step($msg) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Assert-Command($cmd) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Required command '$cmd' not found. Please install it and try again."
    }
}

# --- Preflight checks ---
Write-Step 'Preflight checks'
Assert-Command 'node'
Assert-Command 'npm'
Assert-Command 'git'

$nodeVersion = (node --version)
Write-Host "Node.js: $nodeVersion"
Write-Host "npm:     $(npm --version)"
Write-Host "git:     $(git --version)"
Write-Host "Root:    $rootDir"

# Verify we're in the right place
if (-not (Test-Path (Join-Path $cacheDir 'update.js'))) {
    throw "Cannot find cache/update.js. Make sure you run this script from the group-ironmen directory or its scripts/ subfolder."
}

# --- Step 1: Install cache dependencies ---
Write-Step 'Installing cache dependencies'
Push-Location $cacheDir
try {
    if (Test-Path 'node_modules') {
        Write-Host 'node_modules exists, running npm ci...'
    } else {
        Write-Host 'No node_modules, running npm ci...'
    }
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed in cache/' }
} finally {
    Pop-Location
}

# --- Step 2: Run cache dump + site sync ---
if (-not $SkipCacheDump) {
    Write-Step 'Running cache dump with site sync'
    Push-Location $cacheDir
    try {
        $env:OSRS_CACHE_SYNC_SITE = '1'
        if ($CachePath) {
            $env:OSRS_CACHE_PATH = $CachePath
            Write-Host "Using custom cache path: $CachePath"
        }
        if ($DumpDir) {
            $env:OSRS_CACHE_DUMP_DIR = $DumpDir
            Write-Host "Using custom dump dir: $DumpDir"
        }
        node update.js
        if ($LASTEXITCODE -ne 0) { throw 'cache/update.js failed' }
    } finally {
        # Clean up env vars
        Remove-Item Env:\OSRS_CACHE_SYNC_SITE -ErrorAction SilentlyContinue
        Remove-Item Env:\OSRS_CACHE_PATH -ErrorAction SilentlyContinue
        Remove-Item Env:\OSRS_CACHE_DUMP_DIR -ErrorAction SilentlyContinue
        Pop-Location
    }
} else {
    Write-Host 'Skipping cache dump (--SkipCacheDump)' -ForegroundColor Yellow
}

# --- Step 3: Find latest dump directory ---
Write-Step 'Finding latest dump directory'
$dumpsRoot = Join-Path $cacheDir 'dumps'
if (Test-Path $dumpsRoot) {
    $latestDump = Get-ChildItem -Path $dumpsRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
    if ($latestDump) {
        Write-Host "Latest dump: $($latestDump.FullName)"
    } else {
        throw 'No dump directories found in cache/dumps/'
    }
} else {
    throw 'cache/dumps/ directory does not exist'
}

# --- Step 4: Update equipment.json ---
if (-not $SkipEquipment) {
    Write-Step 'Updating equipment.json from cache item data'
    $importScript = Join-Path $scriptsDir 'import-cache-equipment.js'
    if (-not (Test-Path $importScript)) {
        throw "Cannot find scripts/import-cache-equipment.js"
    }

    $itemDataDir = Join-Path $latestDump.FullName 'item-data'
    if (-not (Test-Path $itemDataDir)) {
        Write-Host "Warning: item-data not found in latest dump, skipping equipment import" -ForegroundColor Yellow
    } else {
        $itemDataCount = (Get-ChildItem -Path $itemDataDir -Filter '*.json' | Measure-Object).Count
        Write-Host "Found $itemDataCount item definitions in $itemDataDir"

        Push-Location $rootDir
        try {
            node $importScript --dump-dir $latestDump.FullName
            if ($LASTEXITCODE -ne 0) { throw 'import-cache-equipment.js failed' }
        } finally {
            Pop-Location
        }
    }
} else {
    Write-Host 'Skipping equipment import (--SkipEquipment)' -ForegroundColor Yellow
}

# --- Step 5: Build site ---
if (-not $SkipBuild) {
    Write-Step 'Building site frontend'
    Push-Location $siteDir
    try {
        if (-not (Test-Path 'node_modules')) {
            Write-Host 'Installing site dependencies...'
            npm ci
            if ($LASTEXITCODE -ne 0) { throw 'npm ci failed in site/' }
        }
        npm run bundle
        if ($LASTEXITCODE -ne 0) { throw 'site build failed' }
    } finally {
        Pop-Location
    }
} else {
    Write-Host 'Skipping site build (--SkipBuild)' -ForegroundColor Yellow
}

# --- Step 6: Summary ---
Write-Step 'Update summary'
$dataDir = Join-Path $siteDir 'public' 'data'
$itemImagesDir = Join-Path $siteDir 'public' 'icons' 'items'

$files = @(
    @{ Name = 'item_data.json';                Path = Join-Path $dataDir 'item_data.json' }
    @{ Name = 'equipment.json';                 Path = Join-Path $dataDir 'equipment.json' }
    @{ Name = 'collection_log_info.json';       Path = Join-Path $dataDir 'collection_log_info.json' }
    @{ Name = 'collection_log_duplicates.json'; Path = Join-Path $dataDir 'collection_log_duplicates.json' }
    @{ Name = 'map_icons.json';                 Path = Join-Path $dataDir 'map_icons.json' }
    @{ Name = 'map_labels.json';                Path = Join-Path $dataDir 'map_labels.json' }
)

foreach ($f in $files) {
    if (Test-Path $f.Path) {
        $size = [math]::Round((Get-Item $f.Path).Length / 1KB, 1)
        Write-Host "  [OK] $($f.Name) ($size KB)" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $($f.Name)" -ForegroundColor Red
    }
}

if (Test-Path $itemImagesDir) {
    $imageCount = (Get-ChildItem -Path $itemImagesDir -Filter '*.webp' | Measure-Object).Count
    Write-Host "  [OK] Item images: $imageCount .webp files" -ForegroundColor Green
} else {
    Write-Host "  [MISSING] Item images directory" -ForegroundColor Red
}

# --- Step 7: Git commit + push ---
if ($Push) {
    Write-Step 'Committing and pushing changes'
    Push-Location $rootDir
    try {
        $status = git status --porcelain
        if (-not $status) {
            Write-Host 'No changes to commit.' -ForegroundColor Yellow
        } else {
            $changedCount = ($status -split "`n").Count
            Write-Host "$changedCount file(s) changed"

            git add site/public/data/ site/public/icons/items/ site/public/map/
            if ($LASTEXITCODE -ne 0) { throw 'git add failed' }

            if (-not $CommitMessage) {
                $CommitMessage = "Update OSRS cache data $(Get-Date -Format 'yyyy-MM-dd')"
            }
            git commit -m $CommitMessage
            if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }

            Write-Host "`nReady to push. Pushing..." -ForegroundColor Yellow
            git push
            if ($LASTEXITCODE -ne 0) { throw 'git push failed' }

            Write-Host 'Push complete!' -ForegroundColor Green
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`nRun with -Push to git commit and push the changes." -ForegroundColor DarkGray
}

Write-Host "`nDone!" -ForegroundColor Green
