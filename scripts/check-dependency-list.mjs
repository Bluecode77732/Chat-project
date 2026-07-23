// Purpose: verifies README.md's "Total Installation" Dependencies/DevDependencies
//   lists (name-for-name, and their "(N)" counts) match backend/package.json --
//   the two drifted out of sync twice in one documentation pass before either
//   was caught, purely because nothing checked them against each other.
// Usage: `pnpm check:deps` (root script).
// Rationale: this is the lowest-risk of the sustainability checks added
//   alongside it (check-config-values.mjs, the heading-parity check in
//   check-adr-integrity.mjs) -- it's a pure set-diff against package.json, so
//   there's no heuristic to get wrong and no false-positive risk. It fails
//   (not warns) on any mismatch for that reason.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

let errorCount = 0;
function fail(source, msg) {
  console.error(`✗ ${source}: ${msg}`);
  errorCount++;
}

function read(relPath) {
  return readFileSync(resolve(repoRoot, relPath), 'utf8');
}

const pkg = JSON.parse(read('backend/package.json'));
const readmeText = read('README.md');
const readmeLines = readmeText.split(/\r?\n/);

// Extracts a labelled bullet list ("Dependencies (44)" / "- pkg-name ...") that
// starts at the line matching `header` and runs until the first blank line.
// Trailing parenthetical notes on a bullet (e.g. "- ts-jest (custom jest
// config)") are stripped -- only the leading package name is a claim this
// script can check against package.json.
function extractLabelledList(header) {
  const startIdx = readmeLines.findIndex((l) => l.startsWith(header));
  if (startIdx === -1) return null;

  const matchedLine = readmeLines[startIdx];
  const countMatch = /\((\d+)\)/.exec(matchedLine);
  const claimedCount = countMatch ? Number(countMatch[1]) : null;

  const names = [];
  for (let i = startIdx + 1; i < readmeLines.length; i++) {
    const line = readmeLines[i];
    if (line.trim() === '') break;
    const m = /^-\s+(\S+)/.exec(line);
    if (m) names.push(m[1]);
  }
  return { claimedCount, names, matchedLine };
}

function checkSection(label, header, pkgField) {
  const parsed = extractLabelledList(header);
  if (!parsed) {
    fail('README.md', `could not find a "${header}" section -- this checker's header string is stale`);
    return;
  }
  const { claimedCount, names, matchedLine } = parsed;
  const actual = new Set(Object.keys(pkg[pkgField] ?? {}));
  const listed = new Set(names);

  if (claimedCount !== null && claimedCount !== names.length) {
    fail(
      'README.md',
      `"${matchedLine}" says (${claimedCount}) but the list under it has ${names.length} entries`,
    );
  }
  if (claimedCount !== null && claimedCount !== actual.size) {
    fail(
      'README.md',
      `"${matchedLine}" says (${claimedCount}) but backend/package.json's ${pkgField} has ${actual.size} entries`,
    );
  }

  const missingFromReadme = [...actual].filter((n) => !listed.has(n));
  const extraInReadme = [...listed].filter((n) => !actual.has(n));
  if (missingFromReadme.length) {
    fail('README.md', `${label} missing from README but present in backend/package.json: ${missingFromReadme.join(', ')}`);
  }
  if (extraInReadme.length) {
    fail('README.md', `${label} listed in README but absent from backend/package.json: ${extraInReadme.join(', ')}`);
  }
}

checkSection('dependency', 'Dependencies (', 'dependencies');
checkSection('devDependency', 'DevDependencies (', 'devDependencies');

console.log(`\nChecked README.md's dependency lists against backend/package.json. ${errorCount} error(s).`);
process.exit(errorCount > 0 ? 1 : 0);
