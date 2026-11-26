# PowerShell one-click launcher for pathy-knowledge-web
param(
    [int]$Port = 5173,
    [string]$ApiTarget = "http://127.0.0.1:8765",
    # Match vite `base`; default /wiki/ -> http://<host>:<port>/wiki/
    [string]$Base = "/wiki/"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $scriptDir
$EmbeddedNodeVersion = "22.13.0"

function Invoke-Tool {
    param(
        [string]$Exe,
        [string[]]$CommandArgs
    )
    & $Exe @CommandArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed (exit $LASTEXITCODE): $Exe $($CommandArgs -join ' ')"
    }
}

function Compare-SemVer {
    param(
        [string]$A,
        [string]$B
    )
    $aClean = $A.TrimStart("v")
    $bClean = $B.TrimStart("v")
    $aParts = $aClean.Split(".")
    $bParts = $bClean.Split(".")
    for ($i = 0; $i -lt 3; $i++) {
        $ai = if ($i -lt $aParts.Count) { [int]$aParts[$i] } else { 0 }
        $bi = if ($i -lt $bParts.Count) { [int]$bParts[$i] } else { 0 }
        if ($ai -lt $bi) { return -1 }
        if ($ai -gt $bi) { return 1 }
    }
    return 0
}

function Test-NodeVersionSupported {
    param(
        [string]$Version
    )
    $v = $Version.TrimStart("v")
    $parts = $v.Split(".")
    $major = if ($parts.Count -gt 0) { [int]$parts[0] } else { 0 }

    if ($major -eq 20) {
        return (Compare-SemVer -A $v -B "20.19.0") -ge 0
    }
    if ($major -eq 22) {
        return (Compare-SemVer -A $v -B "22.12.0") -ge 0
    }
    if ($major -ge 23) {
        return $true
    }
    return $false
}

function Ensure-NodeOnPath {
    if (Get-Command node -ErrorAction SilentlyContinue) { return $true }
    $nodeDirs = @(
        "$env:ProgramFiles\nodejs",
        "${env:ProgramFiles(x86)}\nodejs",
        "$env:LOCALAPPDATA\Programs\node"
    )
    foreach ($dir in $nodeDirs) {
        if (Test-Path (Join-Path $dir "node.exe")) {
            $env:Path = "$dir;" + $env:Path
            return $true
        }
    }
    return $false
}

function Initialize-EmbeddedNodeWindows {
    $isWindows = $env:OS -eq "Windows_NT"
    if (-not $isWindows) { return $null }

    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
    if ($arch -ne "x64") {
        throw "Automatic Node bootstrap currently supports Windows x64 only. Current architecture: $arch"
    }

    $runtimeRoot = Join-Path $scriptDir ".node-runtime"
    $runtimeDir = Join-Path $runtimeRoot "node-v$EmbeddedNodeVersion-win-x64"
    $nodeExe = Join-Path $runtimeDir "node.exe"
    $npmCmd = Join-Path $runtimeDir "npm.cmd"

    if (-not (Test-Path $nodeExe) -or -not (Test-Path $npmCmd)) {
        $zipUrl = "https://nodejs.org/dist/v$EmbeddedNodeVersion/node-v$EmbeddedNodeVersion-win-x64.zip"
        $zipPath = Join-Path $runtimeRoot "node-runtime.zip"

        Write-Host "==> No suitable system Node.js found, bootstrapping portable Node.js (v$EmbeddedNodeVersion)..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

        Write-Host "==> Downloading portable Node.js" -ForegroundColor Yellow
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath

        Write-Host "==> Extracting portable Node.js" -ForegroundColor Yellow
        Expand-Archive -Path $zipPath -DestinationPath $runtimeRoot -Force
        Remove-Item $zipPath -Force
    }

    if (-not (Test-Path $nodeExe) -or -not (Test-Path $npmCmd)) {
        throw "Portable Node bootstrap failed: node.exe/npm.cmd not found after extraction."
    }

    $env:Path = "$runtimeDir;" + $env:Path
    $nodeVer = (& $nodeExe --version 2>&1 | Out-String).Trim()
    $npmVer = (& $npmCmd --version 2>&1 | Out-String).Trim()
    return @{ NodeExe = $nodeExe; NpmCmd = $npmCmd; Node = $nodeVer; Npm = $npmVer; Kind = "embedded" }
}

function Get-NodeTooling {
    if (-not (Ensure-NodeOnPath)) { return $null }
    $node = Get-Command node -ErrorAction SilentlyContinue
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $node -or -not $npm) { return $null }
    $nodeVer = (& node --version 2>&1 | Out-String).Trim()
    $npmVer = (& npm --version 2>&1 | Out-String).Trim()
    if (-not (Test-NodeVersionSupported -Version $nodeVer)) {
        Write-Host "==> System Node.js $nodeVer is below Vite requirement (20.19+ or 22.12+), will use portable Node.js." -ForegroundColor Yellow
        return $null
    }
    return @{ Node = $nodeVer; Npm = $npmVer }
}

function Repair-NpmDependenciesIfNeeded {
    param(
        [hashtable]$Tools
    )

    $rolldownBindingDir = Join-Path $scriptDir "node_modules\@rolldown\binding-win32-x64-msvc"
    $rolldownCoreDir = Join-Path $scriptDir "node_modules\rolldown"
    if ((Test-Path $rolldownCoreDir) -and -not (Test-Path $rolldownBindingDir)) {
        Write-Host "==> Missing rolldown native binding detected, auto-repairing dependencies..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force (Join-Path $scriptDir "node_modules") -ErrorAction SilentlyContinue
        Remove-Item -Force (Join-Path $scriptDir "package-lock.json") -ErrorAction SilentlyContinue
        if ($Tools.NpmCmd) {
            Invoke-Tool -Exe $Tools.NpmCmd -CommandArgs @("install")
        } else {
            npm install
            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed during dependency repair."
            }
        }
    }
}

Write-Host "==> Starting pathy-knowledge-web on port $Port" -ForegroundColor Cyan
Write-Host "==> VITE_DEV_PROXY_TARGET = $ApiTarget" -ForegroundColor Cyan
$entryHint = if ($Base -eq '/' -or $Base -eq '') { "http://127.0.0.1:$Port/" } else { "http://127.0.0.1:$Port$Base" }
Write-Host "==> VITE_BASE = $Base (dev entry: $entryHint)" -ForegroundColor Cyan

$tools = Get-NodeTooling
if (-not $tools) {
    $tools = Initialize-EmbeddedNodeWindows
}
if (-not $tools) {
    Write-Host ""
    Write-Host "No usable Node.js found and automatic bootstrap is unavailable on this platform." -ForegroundColor Red
    Write-Host "Install Node.js LTS manually, then rerun this script." -ForegroundColor Yellow
    throw "No usable Node.js."
}

Write-Host "==> Using node $($tools.Node), npm $($tools.Npm)" -ForegroundColor Green
if ($tools.Kind -eq "embedded") {
    Write-Host "==> Using project-local portable Node.js runtime (no global install needed)" -ForegroundColor Green
}

$env:VITE_DEV_PROXY_TARGET = $ApiTarget
$env:VITE_BASE = $Base

Write-Host "==> Installing dependencies" -ForegroundColor Yellow
if ($tools.NpmCmd) {
    Invoke-Tool -Exe $tools.NpmCmd -CommandArgs @("install")
} else {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed. Check the error output above."
    }
}
Repair-NpmDependenciesIfNeeded -Tools $tools

Write-Host "==> Launching Vite dev server" -ForegroundColor Green
if ($tools.NpmCmd) {
    Invoke-Tool -Exe $tools.NpmCmd -CommandArgs @("run", "dev", "--", "--host", "0.0.0.0", "--port", "$Port")
} else {
    npm run dev -- --host 0.0.0.0 --port $Port
}
