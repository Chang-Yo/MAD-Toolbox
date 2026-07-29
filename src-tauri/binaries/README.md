# Bundled CLI binaries

The Lite build always includes BBDown and resolves other tools from the system.

Required Apple Silicon filename:

```text
BBDown-aarch64-apple-darwin
```

Required Windows x64 filenames:

```text
BBDown-x86_64-pc-windows-msvc.exe
ffmpeg-x86_64-pc-windows-msvc.exe
ffprobe-x86_64-pc-windows-msvc.exe
mediainfo-x86_64-pc-windows-msvc.exe
yt-dlp-x86_64-pc-windows-msvc.exe
deno-x86_64-pc-windows-msvc.exe
```

Do not commit downloaded archives. Binary provenance and checksums are recorded
in `third_party/sources.json` and `third_party/windows-sources.json`.
