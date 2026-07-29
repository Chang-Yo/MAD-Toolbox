#!/bin/sh
set -eu

project_directory="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
app="$project_directory/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MAD Toolbox.app"
dmg_directory="$project_directory/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg"
dmg="$dmg_directory/MAD Toolbox_0.4.9_aarch64.dmg"
yt_dlp="$project_directory/src-tauri/binaries/yt-dlp-aarch64-apple-darwin"
staging_directory="$(mktemp -d /private/tmp/mad-toolbox-full-dmg.XXXXXX)"

cleanup() {
  rm -rf "$staging_directory"
}
trap cleanup EXIT INT TERM

cd "$project_directory"
npm run verify:bundled
npm exec tauri -- build \
  --target aarch64-apple-darwin \
  --config src-tauri/tauri.full.conf.json \
  --bundles app

# Tauri applies hardened runtime to every sidecar. The official PyInstaller
# yt-dlp executable extracts a Python framework whose signature is incompatible
# with hardened library validation. Restore the verified upstream ad-hoc
# signature, then reseal only the outer application bundle.
cp "$yt_dlp" "$app/Contents/MacOS/yt-dlp"
chmod 755 "$app/Contents/MacOS/yt-dlp"
codesign --force --sign - --options runtime "$app"
codesign --verify --deep --strict "$app"
"$app/Contents/MacOS/yt-dlp" --version | grep -q "2026.07.04"

mkdir -p "$dmg_directory"
ditto "$app" "$staging_directory/MAD Toolbox.app"
ln -s /Applications "$staging_directory/Applications"
rm -f "$dmg"
hdiutil create \
  -volname "MAD Toolbox" \
  -srcfolder "$staging_directory" \
  -ov \
  -format UDZO \
  "$dmg"

echo "Full macOS app: $app"
echo "Full macOS DMG: $dmg"
shasum -a 256 "$dmg"
