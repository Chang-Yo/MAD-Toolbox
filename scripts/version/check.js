// Verifies that every tracked version reference matches package.json:
// package-lock.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml,
// src-tauri/Cargo.lock and docs/WINDOWS.md. Exits non-zero on any mismatch.
//
// Usage: npm run version:check
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const versionDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(path.dirname(versionDirectory));
const crateName = "mad-toolbox";

const expected = JSON.parse(
  readFileSync(path.join(projectDirectory, "package.json"), "utf8")
).version;
if (!/^\d+\.\d+\.\d+$/.test(expected)) {
  console.error(`package.json has an invalid version '${expected}'.`);
  process.exit(1);
}

const checks = [
  {
    file: "package-lock.json",
    label: "package-lock.json (root)",
    extract: (content) => JSON.parse(content).version
  },
  {
    file: "package-lock.json",
    label: "package-lock.json (workspace entry)",
    extract: (content) => JSON.parse(content).packages?.[""]?.version
  },
  {
    file: "src-tauri/tauri.conf.json",
    label: "src-tauri/tauri.conf.json",
    extract: (content) => JSON.parse(content).version
  },
  {
    file: "src-tauri/Cargo.toml",
    label: "src-tauri/Cargo.toml",
    extract: (content) => content.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
  },
  {
    file: "src-tauri/Cargo.lock",
    label: "src-tauri/Cargo.lock",
    extract: (content) =>
      content.match(new RegExp(`name = "${crateName}"\\s*\\nversion = "([^"]+)"`))?.[1]
  },
  {
    file: "docs/WINDOWS.md",
    label: "docs/WINDOWS.md",
    extract: (content) => content.match(/MAD Toolbox (\d+\.\d+\.\d+)/)?.[1]
  }
];

const failures = [];
for (const check of checks) {
  const found = check.extract(readFileSync(path.join(projectDirectory, check.file), "utf8"));
  if (found !== expected) {
    failures.push(`${check.label}: expected ${expected}, found ${found ?? "(not found)"}`);
  }
}

if (failures.length > 0) {
  console.error("Version references are out of sync:");
  for (const failure of failures) {
    console.error(`  ${failure}`);
  }
  console.error("Run 'npm run version:bump -- <patch|minor|major|x.y.z>' to align them.");
  process.exit(1);
}

console.log(`All version references are ${expected}.`);
