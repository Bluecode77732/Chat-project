// Purpose: verifies CHANGELOG.md/.ko.md list every commit in `git log`, grouped
//   under the right date heading -- the two drifted 70 commits apart before
//   anyone noticed, because CHANGELOG.md was written once and never touched
//   again while check:adr only ever verified its .ko pair and heading parity.
// Usage: `pnpm check:changelog` (root script); wired into deploy.yml's test job.
// Rationale: check-adr-integrity.mjs already lists CHANGELOG.md in `rootPairs`,
//   but a stale EN file and an equally stale KO file pass its parity check
//   happily -- nothing compared either against the actual commit history.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

let errorCount = 0;
function fail(source, msg) {
  console.error(`✗ ${source}: ${msg}`);
  errorCount++;
}

function git(...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

// A shallow clone (actions/checkout's default fetch-depth: 1) would make this
// script "pass" against a single commit, silently turning the gate into a
// no-op. Hard-fail instead so a workflow regression is visible.
if (git('rev-parse', '--is-shallow-repository').trim() === 'true') {
  fail('git', 'shallow clone -- this check needs full history (set fetch-depth: 0 on actions/checkout)');
  console.error('\nAborted before comparing.');
  process.exit(1);
}

// Commit subjects can contain literal CR characters (three early commits do),
// which would split one commit across several output lines. Delimit records
// with NUL and strip CR rather than relying on one-commit-per-line.
const rawLog = git('log', '--format=%ad|%s%x00', '--date=short');
const commits = rawLog
  .split('\0')
  .map((chunk) => chunk.replace(/\r/g, '').replace(/^\n+/, ''))
  .filter((chunk) => chunk.trim() !== '')
  .map((chunk) => {
    const idx = chunk.indexOf('|');
    return { date: chunk.slice(0, idx), subject: chunk.slice(idx + 1).trim() };
  });

// On `pull_request` runs, actions/checkout builds a synthetic merge commit
// ("Merge <sha> into <sha>") that exists only for the CI run and can never be
// in the changelog. Drop it outright.
const SYNTHETIC_MERGE = /^Merge [0-9a-f]{40} into [0-9a-f]{40}$/;
const realCommits = commits.filter((c) => !SYNTHETIC_MERGE.test(c.subject));

// Real merge commits are tolerated when absent, not excluded: GitHub's PR
// merges ("Merge pull request #N from ...") exist only on main, while this
// changelog is maintained on dev -- a PR/push-to-main checkout sees them but a
// dev checkout never does (surfaced by PR #12's CI failing on #11's merge
// commit). Merge commits that *are* recorded (dev's own historical merges)
// still match normally, so every existing entry stays verified.
const TOLERATED_MERGE = /^Merge (pull request #\d+ from |branch |remote-tracking branch )/;

function parseChangelog(relPath) {
  const lines = readFileSync(resolve(repoRoot, relPath), 'utf8').split(/\r?\n/);
  const sections = new Map();
  const dateOrder = [];
  let current = null;
  for (const line of lines) {
    const heading = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(line);
    if (heading) {
      current = heading[1];
      if (!sections.has(current)) {
        sections.set(current, []);
        dateOrder.push(current);
      }
      continue;
    }
    const entry = /^-\s+(.*)$/.exec(line);
    if (current && entry) sections.get(current).push(entry[1].trim());
  }
  return { sections, dateOrder };
}

function checkFile(relPath) {
  const { sections, dateOrder } = parseChangelog(relPath);

  for (let i = 0; i < dateOrder.length - 1; i++) {
    if (dateOrder[i] <= dateOrder[i + 1]) {
      fail(relPath, `date sections must run newest-first: "${dateOrder[i]}" precedes "${dateOrder[i + 1]}"`);
    }
  }

  // Group git commits by date, preserving git's newest-first order.
  const gitByDate = new Map();
  for (const { date, subject } of realCommits) {
    if (!gitByDate.has(date)) gitByDate.set(date, []);
    gitByDate.get(date).push(subject);
  }

  // The commit that updates the changelog cannot list its own subject, so the
  // newest commit is allowed to be absent. Anything older than that is real
  // drift: once one more commit lands on top, the tolerance no longer covers
  // the unrecorded one and this check fails. Skip tolerated merges when
  // picking it: on a PR/push-to-main checkout the newest commit is the merge
  // commit itself, and the tolerance must still cover the newest work commit
  // underneath it.
  const newest = realCommits.find((c) => !TOLERATED_MERGE.test(c.subject));
  let toleratedNewest = false;

  for (const [date, subjects] of gitByDate) {
    const listed = sections.get(date) ?? [];
    const pool = [...listed];
    const missing = [];
    for (const subject of subjects) {
      const idx = pool.indexOf(subject);
      if (idx >= 0) pool.splice(idx, 1);
      else missing.push(subject);
    }
    for (const m of missing) {
      if (!toleratedNewest && newest && date === newest.date && m === newest.subject) {
        toleratedNewest = true;
        continue;
      }
      if (TOLERATED_MERGE.test(m)) continue;
      fail(relPath, `${date}: commit not recorded -- "${m}"`);
    }
    for (const extra of pool) {
      fail(relPath, `${date}: entry has no matching commit -- "${extra}"`);
    }
  }

  for (const date of dateOrder) {
    if (!gitByDate.has(date)) fail(relPath, `${date}: date section has no commits in git log`);
  }

  const entryCount = [...sections.values()].reduce((n, s) => n + s.length, 0);
  return { entryCount, dateCount: dateOrder.length };
}

const en = checkFile('CHANGELOG.md');
const ko = checkFile('CHANGELOG.ko.md');

if (en.entryCount !== ko.entryCount || en.dateCount !== ko.dateCount) {
  fail(
    'CHANGELOG.ko.md',
    `must mirror CHANGELOG.md exactly: EN has ${en.entryCount} entries / ${en.dateCount} dates, ` +
      `KO has ${ko.entryCount} entries / ${ko.dateCount} dates`,
  );
}

console.log(
  `\nChecked CHANGELOG.md + CHANGELOG.ko.md against ${realCommits.length} commits ` +
    `(${en.entryCount} entries / ${en.dateCount} date sections). ${errorCount} error(s).`,
);
process.exit(errorCount > 0 ? 1 : 0);
