param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Full", "Lite")]
  [string]$Edition,
  [string]$TauriArgsJson = "[]"
)

# Windows packaging entry. Runs on Windows PowerShell 5.1; PowerShell 7 is not
# required. Invoked by scripts/build/build.js, which already ran the TypeScript
# and cargo preflight checks.
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location -LiteralPath $ProjectRoot

& (Join-Path $PSScriptRoot "windows-tools.ps1") -Edition $Edition

# Windows PowerShell 5.1 pipes a ConvertFrom-Json array through as a single
# object instead of enumerating it, so collect the entries explicitly.
$TauriArgs = @()
$ParsedArgs = $TauriArgsJson | ConvertFrom-Json
if ($null -ne $ParsedArgs) {
  foreach ($Item in @($ParsedArgs)) {
    if ($null -ne $Item) { $TauriArgs += [string]$Item }
  }
}

$Config = if ($Edition -eq "Full") {
  "src-tauri\tauri.windows.full.conf.json"
} else {
  "src-tauri\tauri.windows.lite.conf.json"
}
npx tauri build --target x86_64-pc-windows-msvc --config $Config @TauriArgs
if ($LASTEXITCODE -ne 0) { throw "Tauri build failed" }
