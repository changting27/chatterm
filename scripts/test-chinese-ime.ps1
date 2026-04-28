<#
.SYNOPSIS
  Chinese IME dedup logic test. Runs Node.js test that verifies the
  compositionend dedup logic from XtermPane.tsx.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\test-chinese-ime.ps1
#>
$ErrorActionPreference = "Stop"

Write-Host "`n=== Chinese IME Dedup Test ===" -ForegroundColor Cyan

$jsFile = Join-Path $PSScriptRoot "test-chinese-ime.js"
if (-not (Test-Path $jsFile)) {
    Write-Host "  [ERROR] $jsFile not found" -ForegroundColor Red
    exit 1
}

& node $jsFile
exit $LASTEXITCODE
