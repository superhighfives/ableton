#!/usr/bin/env node
// Root-level control for every extension in this repo.
//
// Each extension folder is a self-contained package (its own package.json,
// lockfile and node_modules), so this doesn't use a pnpm workspace — it just
// discovers the extensions and fans a command out to each one.
//
// Usage:
//   node scripts/extensions.mjs <command> [names...]
//
// Commands:
//   list                  Show the discovered extensions (name + version)
//   install [names...]    pnpm install in each
//   build   [names...]    Dev build in each        (pnpm build:dev)
//   build:prod [names...] Production build in each  (pnpm build)
//   test    [names...]    Run tests where present   (pnpm test)
//   package [names...]    Build a .ablx in each     (pnpm package → <ext>/build)
//   run <name>            Run ONE extension in Live's dev Extension Host (pnpm start)
//
// `names` filter to specific extensions by folder name; omit to hit all.
// Everything but `run` runs sequentially so the logs stay readable.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS_DIR = join(ROOT, "extensions");

/** Read JSON, or return null if it isn't there / doesn't parse. */
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** An extension is any folder inside extensions/ with a manifest.json. */
function discover() {
  return readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(EXTENSIONS_DIR, e.name, "manifest.json")))
    .map((e) => {
      const dir = join(EXTENSIONS_DIR, e.name);
      const manifest = readJson(join(dir, "manifest.json")) ?? {};
      const pkg = readJson(join(dir, "package.json")) ?? {};
      return {
        folder: e.name,
        dir,
        name: manifest.name ?? e.name,
        version: manifest.version ?? "?",
        scripts: pkg.scripts ?? {},
      };
    })
    .sort((a, b) => a.folder.localeCompare(b.folder));
}

/** Keep only the requested folders; error if a name doesn't match. */
function select(exts, names) {
  if (names.length === 0) return exts;
  const known = new Set(exts.map((e) => e.folder));
  const unknown = names.filter((n) => !known.has(n));
  if (unknown.length) {
    fail(`unknown extension(s): ${unknown.join(", ")}\nknown: ${exts.map((e) => e.folder).join(", ")}`);
  }
  return exts.filter((e) => names.includes(e.folder));
}

/** Run a pnpm invocation in an extension folder, inheriting the terminal. */
function pnpm(ext, args) {
  const result = spawnSync("pnpm", args, { cwd: ext.dir, stdio: "inherit" });
  if (result.error?.code === "ENOENT") {
    fail("pnpm not found on PATH — install it (npm i -g pnpm, or corepack enable pnpm).");
  }
  return result.status ?? 1;
}

function fail(message) {
  console.error(`\nerror: ${message}`);
  process.exit(1);
}

function header(text) {
  console.log(`\n\x1b[1m▸ ${text}\x1b[0m`);
}

// --- Commands ---------------------------------------------------------------

/** Fan a pnpm script out to each extension; `optional` scripts are skipped
 *  (not failed) where an extension doesn't define them. Returns exit code. */
function fanOut(exts, label, args, { requireScript, optional } = {}) {
  let failures = 0;
  let skipped = 0;
  for (const ext of exts) {
    header(`${ext.folder} — ${label}`);
    if (requireScript && !ext.scripts[requireScript]) {
      if (optional) {
        console.log(`  (no "${requireScript}" script — skipped)`);
        skipped++;
        continue;
      }
      console.error(`  missing "${requireScript}" script`);
      failures++;
      continue;
    }
    if (pnpm(ext, args) !== 0) failures++;
  }
  if (failures) {
    console.error(`\n${failures} extension(s) failed "${label}".`);
    return 1;
  }
  const ran = exts.length - skipped;
  const tail = skipped ? ` (${skipped} skipped)` : "";
  console.log(`\n${ran} extension(s): ${label} ✓${tail}`);
  return 0;
}

/** Print the discovered extensions and the common commands. */
function listExtensions(exts) {
  console.log(`Extensions in this repo (${exts.length}):\n`);
  for (const e of exts) {
    const scripts = Object.keys(e.scripts).join(", ") || "—";
    console.log(`  ${e.folder.padEnd(14)} v${e.version.padEnd(8)} [${scripts}]`);
  }
  console.log(`\nRun one in Live:   node scripts/extensions.mjs run <name>`);
  console.log(`Build all:         node scripts/extensions.mjs build`);
  console.log(`Package all:       node scripts/extensions.mjs package`);
}

function main() {
  const [command, ...names] = process.argv.slice(2);
  const exts = discover();

  if (!command || command === "list") {
    listExtensions(exts);
    return;
  }

  if (command === "run") {
    // No name → list (so `pnpm start` alone is a friendly picker, as documented).
    if (names.length === 0) {
      listExtensions(exts);
      return;
    }
    if (names.length > 1) {
      fail(`run takes exactly one extension.\nusage: node scripts/extensions.mjs run <${exts.map((e) => e.folder).join("|")}>`);
    }
    const [ext] = select(exts, names);
    header(`${ext.folder} — running in Live's Extension Host (Ctrl-C to stop)`);
    process.exit(pnpm(ext, ["start"]));
  }

  const chosen = select(exts, names);
  switch (command) {
    case "install":
      return process.exit(fanOut(chosen, "install", ["install"]));
    case "build":
      return process.exit(fanOut(chosen, "build:dev", ["run", "build:dev"], { requireScript: "build:dev" }));
    case "build:prod":
      return process.exit(fanOut(chosen, "build", ["run", "build"], { requireScript: "build" }));
    case "test":
      return process.exit(fanOut(chosen, "test", ["run", "test"], { requireScript: "test", optional: true }));
    case "package":
      return process.exit(fanOut(chosen, "package", ["run", "package"], { requireScript: "package" }));
    default:
      fail(`unknown command "${command}".\ncommands: list, install, build, build:prod, test, package, run`);
  }
}

main();
