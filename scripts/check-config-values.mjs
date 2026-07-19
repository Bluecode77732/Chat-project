// Purpose: verifies MODERATION_DEFAULTS values (single source of truth in
//   moderation.constants.ts) stay in sync across the three other places that
//   mirror them: CLAUDE.md, backend/.env.example, and README.md/README.ko.md's
//   Moderation section -- exactly the four locations README's own blockquote
//   names and asks a human to keep in sync by hand.
// Usage: `pnpm check:config` (root script).
// Rationale: an ARCHITECTURE.md sustainability review found this exact
//   four-location mirror had no verification, unlike file:line citations which
//   check-adr-integrity.mjs already covers -- this script targets the "did the
//   quoted VALUE actually get re-synced" gap that script does not.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

let errorCount = 0;
let warnCount = 0;

function fail(source, msg) {
  console.error(`✗ ${source}: ${msg}`);
  errorCount++;
}

function warn(source, msg) {
  console.warn(`~ ${source}: ${msg}`);
  warnCount++;
}

function read(relPath) {
  return readFileSync(resolve(repoRoot, relPath), 'utf8');
}

// tsKey (as it appears in MODERATION_DEFAULTS) -> the env var name it backs
const FIELD_MAP = {
  strikeWindowSec: 'MODERATION_STRIKE_WINDOW_SEC',
  warnThreshold: 'MODERATION_WARN_THRESHOLD',
  muteThreshold: 'MODERATION_MUTE_THRESHOLD',
  muteDurationSec: 'MODERATION_MUTE_DURATION_SEC',
  banThreshold: 'MODERATION_BAN_THRESHOLD',
  banDurationSec: 'MODERATION_BAN_DURATION_SEC',
  dupWindowSec: 'MODERATION_DUP_WINDOW_SEC',
  dupThreshold: 'MODERATION_DUP_THRESHOLD',
};

// ---- 1. Source of truth: MODERATION_DEFAULTS in moderation.constants.ts ----
const constantsPath = 'backend/src/moderation/constants/moderation.constants.ts';
const constantsText = read(constantsPath);
const truth = {};
for (const [tsKey, envName] of Object.entries(FIELD_MAP)) {
  const m = new RegExp(`\\b${tsKey}:\\s*(\\d+)`).exec(constantsText);
  if (!m) {
    fail(constantsPath, `could not find "${tsKey}:" in MODERATION_DEFAULTS -- this checker's field map is stale`);
    continue;
  }
  truth[envName] = Number(m[1]);
}

if (Object.keys(truth).length === 0) {
  console.error('Could not extract any MODERATION_DEFAULTS values -- aborting.');
  process.exit(1);
}

// ---- 2. backend/.env.example: NAME=value ----
const envExamplePath = 'backend/.env.example';
const envExampleText = read(envExamplePath);
for (const envName of Object.values(FIELD_MAP)) {
  if (!(envName in truth)) continue;
  const m = new RegExp(`^${envName}=(\\d+)\\s*$`, 'm').exec(envExampleText);
  if (!m) {
    warn(envExamplePath, `${envName} not found as "${envName}=<number>" -- verify manually`);
    continue;
  }
  const val = Number(m[1]);
  if (val !== truth[envName]) {
    fail(envExamplePath, `${envName}=${val}, but source of truth (${constantsPath}) says ${truth[envName]}`);
  }
}

// ---- 3. CLAUDE.md: `NAME` (value) ----
const claudeMdPath = 'CLAUDE.md';
const claudeMdText = read(claudeMdPath);
for (const envName of Object.values(FIELD_MAP)) {
  if (!(envName in truth)) continue;
  const m = new RegExp('`' + envName + '`[\\s\\S]{0,25}?\\((?:default\\s+)?(\\d+)\\)').exec(claudeMdText);
  if (!m) {
    warn(claudeMdPath, `${envName} not found in "\`${envName}\` (value)" form -- verify manually`);
    continue;
  }
  const val = Number(m[1]);
  if (val !== truth[envName]) {
    fail(claudeMdPath, `${envName} documented as (${val}), but source of truth (${constantsPath}) says ${truth[envName]}`);
  }
}

// ---- 4. README.md / README.ko.md: values embedded in narrative prose, in
// human units (hours/minutes/days/count) rather than raw seconds. Each
// pattern below is tied to the CURRENT wording of the Moderation section; if
// that prose is reworded, the pattern stops matching and this check WARNS
// "could not locate" instead of silently passing on stale data -- it never
// assumes a non-match means "still correct".
function checkReadmeProse(path, patterns) {
  const text = read(path);
  for (const { env, re, unit, group = 1 } of patterns) {
    if (!(env in truth)) continue;
    const m = re.exec(text);
    if (!m) {
      warn(path, `could not locate prose value for ${env} -- wording may have changed, verify manually`);
      continue;
    }
    const raw = Number(m[group]);
    const val = raw * unit;
    if (val !== truth[env]) {
      fail(
        path,
        `${env}: prose says "${m[0]}" (-> ${val}s), but source of truth (${constantsPath}) says ${truth[env]}s`,
      );
    }
  }
}

checkReadmeProse('README.md', [
  { env: 'MODERATION_DUP_WINDOW_SEC', re: /(\d+)×?\s+within\s+(\d+)s\s+adds\s+a\s+strike/, unit: 1, group: 2 },
  { env: 'MODERATION_DUP_THRESHOLD', re: /(\d+)×\s+within\s+(\d+)s\s+adds\s+a\s+strike/, unit: 1, group: 1 },
  { env: 'MODERATION_STRIKE_WINDOW_SEC', re: /rolling\s+(\d+)h\s+window/, unit: 3600 },
  { env: 'MODERATION_WARN_THRESHOLD', re: /(\d+)\s+strikes?\s*→\s*warning/, unit: 1 },
  { env: 'MODERATION_MUTE_THRESHOLD', re: /(\d+)\s+strikes?\s*→\s*temporary mute/, unit: 1 },
  { env: 'MODERATION_MUTE_DURATION_SEC', re: /temporary mute\*\*\s*—\s*(\d+)\s*min/, unit: 60 },
  { env: 'MODERATION_BAN_THRESHOLD', re: /(\d+)\s+strikes?\s*→\s*timed ban/, unit: 1 },
  { env: 'MODERATION_BAN_DURATION_SEC', re: /timed ban\*\*\s*—\s*(\d+)\s*days?/, unit: 86400 },
]);

checkReadmeProse('README.ko.md', [
  { env: 'MODERATION_DUP_WINDOW_SEC', re: /(\d+)초\s*내에\s*(\d+)회\s*전송하면\s*스트라이크/, unit: 1, group: 1 },
  { env: 'MODERATION_DUP_THRESHOLD', re: /(\d+)초\s*내에\s*(\d+)회\s*전송하면\s*스트라이크/, unit: 1, group: 2 },
  { env: 'MODERATION_STRIKE_WINDOW_SEC', re: /(\d+)시간\s*롤링\s*윈도우/, unit: 3600 },
  { env: 'MODERATION_WARN_THRESHOLD', re: /(\d+)\s*스트라이크\s*→\s*경고/, unit: 1 },
  { env: 'MODERATION_MUTE_THRESHOLD', re: /(\d+)\s*스트라이크\s*→\s*임시\s*뮤트/, unit: 1 },
  { env: 'MODERATION_MUTE_DURATION_SEC', re: /임시\s*뮤트\*\*\s*—\s*(\d+)분/, unit: 60 },
  { env: 'MODERATION_BAN_THRESHOLD', re: /(\d+)\s*스트라이크\s*→\s*기간제\s*밴/, unit: 1 },
  { env: 'MODERATION_BAN_DURATION_SEC', re: /기간제\s*밴\*\*\s*—\s*(\d+)일/, unit: 86400 },
]);

console.log(
  `\nChecked MODERATION_DEFAULTS against 4 mirrors (source: ${constantsPath}). ${errorCount} error(s), ${warnCount} warning(s).`,
);
process.exit(errorCount > 0 ? 1 : 0);
