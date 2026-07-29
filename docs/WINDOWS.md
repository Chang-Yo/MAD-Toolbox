# Windows x64 build

MAD Toolbox 0.5.0 targets Windows 10 22H2 and Windows 11 on Intel/AMD x64
processors (`x86_64-pc-windows-msvc`). ARM64 and 32-bit x86 installers are not
currently produced.

## Feature parity

The Windows GUI uses the same pages and command-generation model as macOS:

- mandatory BBDown QR login, quality/member entitlement handling and advanced
  parameters;
- yt-dlp connectivity testing, global-proxy guidance, explicit proxy and
  advanced parameters;
- file/folder media probing, Premiere-compatible smart MP4 workflow,
  remuxing, stream extraction, ASS/SRT subtitle extraction, professional
  FFmpeg controls and directory task queues;
- optional external Python/musicdl integration;
- encrypted multi-template storage, restoration of the last settings, task
  cancellation that survives page navigation, color logs and per-task
  redacted diagnostic ZIP export.

Long FFmpeg jobs have no five-minute execution limit. They run until the
process exits or the user cancels the task. musicdl search has a separate
30-minute safety timeout.

## Full and Lite installers

Full bundles BBDown, FFmpeg/ffprobe, MediaInfo CLI, yt-dlp and Deno. Lite
bundles BBDown and finds the other programs from WinGet/system, custom paths or
other known Windows installation locations. The executable-source selector in
Settings allows either installer to prefer a newer system or custom version.

Prepare and build:

```powershell
npm install
npm run tauri:build:windows:lite
npm run tauri:build:windows:full
```

The scripts download only missing artifacts and verify pinned SHA-256 values.
The output is a per-user bilingual NSIS installer.

## Credentials and diagnostics

BBDown sessions are stored by Windows Credential Manager. Secret template
fields such as cookies are encrypted with AES-256-GCM in the application's
private data directory; the encryption key is held by Credential Manager.

Diagnostic ZIP files redact command credentials, cookies, proxy credentials,
user paths and environment secrets. They do not export BBDown sessions,
encrypted templates, encryption keys or media contents.

## Unsigned distribution

The installer does not require a paid code-signing certificate. An unsigned
build can be installed and used, but Microsoft Defender SmartScreen may show
an unknown-publisher warning. Users must inspect the download source and
explicitly choose to continue.
