param(
  [ValidateSet("Full", "Lite")]
  [string]$Edition = "Full",
  [string]$TauriArgsJson = "[]"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

& (Join-Path $PSScriptRoot "prepare-windows-tools.ps1") -Edition $Edition
& (Join-Path $PSScriptRoot "verify-windows-tools.ps1") -Edition $Edition

npm run check
if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed" }

cargo check --manifest-path "src-tauri\Cargo.toml" --target x86_64-pc-windows-msvc
if ($LASTEXITCODE -ne 0) { throw "Rust check failed" }

$Config = if ($Edition -eq "Full") {
  "src-tauri\tauri.windows.full.conf.json"
} else {
  "src-tauri\tauri.windows.lite.conf.json"
}
$TauriArgs = @($TauriArgsJson | ConvertFrom-Json)
npx tauri build --target x86_64-pc-windows-msvc --config $Config @TauriArgs
if ($LASTEXITCODE -ne 0) { throw "Tauri build failed" }
