import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(scriptDirectory);
const arguments_ = process.argv.slice(2);

let edition;
const passthrough = [];
for (let index = 0; index < arguments_.length; index += 1) {
  const argument = arguments_[index];
  if (argument === "--edition") {
    edition = arguments_[index + 1];
    index += 1;
  } else if (argument.startsWith("--edition=")) {
    edition = argument.slice("--edition=".length);
  } else if (argument !== "--") {
    passthrough.push(argument);
  }
}

edition = edition?.toLowerCase();
if (edition !== "full" && edition !== "lite") {
  throw new Error("Build edition must be 'full' or 'lite'.");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectDirectory,
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.platform === "win32" && process.arch === "x64") {
  run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(scriptDirectory, "build-windows.ps1"),
    "-Edition",
    edition === "full" ? "Full" : "Lite",
    "-TauriArgsJson",
    JSON.stringify(passthrough)
  ]);
} else if (process.platform === "darwin" && process.arch === "arm64") {
  if (edition === "full") {
    run("/bin/sh", [path.join(scriptDirectory, "build-full-macos.sh"), ...passthrough]);
  } else {
    run("npm", [
      "exec",
      "--",
      "tauri",
      "build",
      "--target",
      "aarch64-apple-darwin",
      ...passthrough
    ]);
  }
} else {
  throw new Error(
    `Unsupported build host: ${process.platform}/${process.arch}. ` +
      "Supported hosts are Windows x64 and Apple Silicon macOS."
  );
}
