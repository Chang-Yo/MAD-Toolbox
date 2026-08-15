#!/bin/sh
# macOS packaging entry for Apple Silicon. Invoked by scripts/build/build.js,
# which already ran the TypeScript and cargo preflight checks.
#
# usage: macos.sh <lite|full> [tauri build arguments...]
set -eu

edition="${1:-}"
if [ "$#" -gt 0 ]; then shift; fi
case "$edition" in
  lite | full) ;;
  *)
    echo "usage: macos.sh <lite|full> [tauri build arguments...]" >&2
    exit 2
    ;;
esac

project_directory="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
app="$project_directory/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MAD Toolbox.app"
dmg_directory="$project_directory/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg"
yt_dlp="$project_directory/src-tauri/binaries/yt-dlp-aarch64-apple-darwin"
bbdown="$project_directory/src-tauri/binaries/BBDown-aarch64-apple-darwin"

cd "$project_directory"
sh "$project_directory/scripts/build/macos-tools.sh" "$edition"

if [ "$edition" = "lite" ]; then
  npm exec tauri -- build --target aarch64-apple-darwin "$@"
  exit 0
fi

staging_directory="$(mktemp -d /private/tmp/mad-toolbox-full-dmg.XXXXXX)"

cleanup() {
  rm -rf "$staging_directory"
}
trap cleanup EXIT INT TERM

version="$(node -p "require('./package.json').version")"
dmg="$dmg_directory/MAD Toolbox_${version}_aarch64.dmg"
npm exec tauri -- build \
  --target aarch64-apple-darwin \
  --config src-tauri/tauri.full.conf.json \
  --bundles app \
  "$@"

# Tauri applies hardened runtime to every sidecar. Restore the verified
# upstream PyInstaller executables byte-for-byte, then reseal only the outer
# application bundle. This keeps BBDown exactly as published upstream and lets
# yt-dlp extract its Python framework without hardened library validation.
cp "$bbdown" "$app/Contents/MacOS/BBDown"
chmod 755 "$app/Contents/MacOS/BBDown"
cp "$yt_dlp" "$app/Contents/MacOS/yt-dlp"
chmod 755 "$app/Contents/MacOS/yt-dlp"
codesign --force --sign - --options runtime "$app"
codesign --verify --deep --strict "$app"
shasum -a 256 "$app/Contents/MacOS/BBDown" |
  grep -q "33597b2b7b83eecb4fbb4f0a50a43f1ada3ac1d9b6adf4eadda8399c700ea470"
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
