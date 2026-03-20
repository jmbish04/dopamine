#!/usr/bin/env node
/**
 * scripts/fix-imports.js
 *
 * Refactors all relative imports (../x or ./x) in TypeScript source files
 * to use the project's @/ path alias (maps to src/).
 *
 * Usage:
 *   node scripts/fix-imports.js                     # dry-run (default)
 *   node scripts/fix-imports.js --write             # write changes to disk
 *   node scripts/fix-imports.js --dir src/backend   # target a subdirectory
 *
 * Safe to re-run — already-aliased imports are skipped.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join, relative, sep } from "path";
import { fileURLToPath } from "url";

// ─── ESM __dirname shim ───────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CWD = process.cwd();

// ─── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--write");
const targetDirArg = (() => {
  const idx = args.indexOf("--dir");
  return idx !== -1 ? args[idx + 1] : "src";
})();

const SRC_ROOT = resolve(CWD, "src");
const TARGET = resolve(CWD, targetDirArg);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".wrangler", ".astro"]);

if (DRY_RUN) {
  console.log("🔍  DRY RUN — pass --write to apply changes\n");
}

// ─── Walk source files ────────────────────────────────────────────────────────
function walkSync(dir, filelist = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkSync(full, filelist);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      filelist.push(full);
    }
  }
  return filelist;
}

// ─── Resolve a relative import specifier to an @/ alias ──────────────────────
function toAlias(fileAbsPath, relativePath) {
  const dir = dirname(fileAbsPath);
  const resolved = resolve(dir, relativePath);

  // Must be inside src/
  if (!resolved.startsWith(SRC_ROOT + sep) && resolved !== SRC_ROOT) return null;

  const rel = resolved.slice(SRC_ROOT.length).replace(/\\/g, "/");
  return `@${rel}`;
}

// ─── Regex — single & double quote relative specifiers ───────────────────────
const RELATIVE_IMPORT_RE = /((?:from|import(?:\s+type)?)\s+)(["'])(\.\.?\/[^"']+)(["'])/g;

// ─── Process ──────────────────────────────────────────────────────────────────
const files = walkSync(TARGET);
let changedFiles = 0;
let totalReplacements = 0;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  let count = 0;

  const updated = original.replace(RELATIVE_IMPORT_RE, (match, prefix, _oq, relPath) => {
    const alias = toAlias(file, relPath);
    if (!alias) return match;
    count++;
    return `${prefix}"${alias}"`;
  });

  if (count > 0) {
    changedFiles++;
    totalReplacements += count;
    const display = relative(CWD, file);
    console.log(`  ✏️  ${display}  (${count} replacement${count > 1 ? "s" : ""})`);
    if (!DRY_RUN) writeFileSync(file, updated, "utf8");
  }
}

console.log(
  `\n${DRY_RUN ? "[DRY RUN] " : "✅ "}` +
  `${totalReplacements} import${totalReplacements !== 1 ? "s" : ""} across ` +
  `${changedFiles} file${changedFiles !== 1 ? "s" : ""} ` +
  `${DRY_RUN ? "would be updated." : "updated."}`
);
