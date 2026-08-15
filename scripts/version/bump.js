// Bumps the project version everywhere it is tracked:
// package.json + package-lock.json (via npm version), src-tauri/tauri.conf.json,
// src-tauri/Cargo.toml, src-tauri/Cargo.lock and docs/WINDOWS.md.
//
// Usage:
//   npm run version:bump -- patch
//   npm run version:bump -- minor
//   npm run version:bump -- major
//   npm run version:bump -- 1.2.3
//
// The bump level is required on purpose: a bare `npm run version:bump` must
// not silently rewrite six files.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const versionDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(path.dirname(versionDirectory));
const crateName = "mad-toolbox";

function readText(relativePath) {
  return readFileSync(path.join(projectDirectory, relativePath), "utf8");
}

function writeText(relativePath, content) {
  writeFileSync(path.join(projectDirectory, relativePath), content);
}

function computeNextVersion(argument, current) {
  if (/^\d+\.\d+\.\d+$/.test(argument)) return argument;
  if (argument === "patch" || argument === "minor" || argument === "major") {
    const [major, minor, patch] = current.split(".").map(Number);
    return argument === "major"
      ? `${major + 1}.0.0`
      : argument === "minor"
        ? `${major}.${minor + 1}.0`
        : `${major}.${minor}.${patch + 1}`;
  }
  throw new Error(
    `Invalid version or bump level '${argument}'. Use 'patch', 'minor', 'major' or 'x.y.z'.`
  );
}

// All non-package version references are updated by string replacement with an
// exactly-once assertion: JSON.stringify would destroy Prettier's condensed
// short-array style in tauri.conf.json, and TOML/lockfile/Markdown have no
// safe parser here. A zero occurrence means the tree is already inconsistent,
// and bumping must fail loudly instead of silently diverging further.
function replaceExactlyOnce(relativePath, from, to) {
  const content = readText(relativePath);
  const occurrences = content.split(from).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `Expected exactly one occurrence of ${JSON.stringify(from)} in ${relativePath}, found ${occurrences}.`
    );
  }
  writeText(relativePath, content.replace(from, to));
}

function runNpmVersion(version) {
  // npm version is the authoritative, offline way to update package.json and
  // both version fields inside package-lock.json at once (the npm equivalent
  // of `pnpm install --lockfile-only`). Node refuses to spawn .cmd shims
  // without a shell (CVE-2024-27980) and deprecates shell:true with an args
  // array, so Windows passes one command string; only the pre-validated
  // version is interpolated.
  const isWindows = process.platform === "win32";
  const result = isWindows
    ? spawnSync(`npm.cmd version ${version} --no-git-tag-version`, {
        cwd: projectDirectory,
        stdio: "inherit",
        shell: true
      })
    : spawnSync("npm", ["version", version, "--no-git-tag-version"], {
        cwd: projectDirectory,
        stdio: "inherit"
      });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm version exited with code ${result.status}.`);
  }
}

try {
  const argument = process.argv[2];
  if (!argument) {
    console.error("Missing the bump level.");
    console.error("Usage: npm run version:bump -- <patch|minor|major|x.y.z>");
    process.exit(1);
  }

  const current = JSON.parse(readText("package.json")).version;
  if (!/^\d+\.\d+\.\d+$/.test(current)) {
    throw new Error(`package.json has an invalid version '${current}'.`);
  }
  const next = computeNextVersion(argument, current);
  if (next === current) {
    console.log(`Version is already ${current}.`);
    process.exit(0);
  }

  runNpmVersion(next);
  replaceExactlyOnce(
    "src-tauri/tauri.conf.json",
    `"version": "${current}"`,
    `"version": "${next}"`
  );
  replaceExactlyOnce("src-tauri/Cargo.toml", `version = "${current}"`, `version = "${next}"`);
  replaceExactlyOnce(
    "src-tauri/Cargo.lock",
    `name = "${crateName}"\nversion = "${current}"`,
    `name = "${crateName}"\nversion = "${next}"`
  );
  replaceExactlyOnce("docs/WINDOWS.md", `MAD Toolbox ${current}`, `MAD Toolbox ${next}`);

  console.log(`Bumped ${current} -> ${next}.`);
  console.log(
    "Updated package.json, package-lock.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock and docs/WINDOWS.md."
  );
  console.log(
    "Remember to add a CHANGELOG.md entry; 'npm run version:check' verifies the references."
  );
} catch (error) {
  console.error(`Failed to bump the version: ${error.message}`);
  process.exit(1);
}
