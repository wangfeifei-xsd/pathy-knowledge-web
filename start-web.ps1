# Compatibility entry point for existing Windows commands.
param([int]$Port, [string]$ApiTarget, [string]$Base)

& (Join-Path $PSScriptRoot "run-scripts/start-web.ps1") @PSBoundParameters
