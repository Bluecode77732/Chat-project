// 목적: MODERATION_DEFAULTS 값(단일 진실 공급원은 moderation.constants.ts)이
//   이를 미러링하는 나머지 세 곳 -- CLAUDE.md, backend/.env.example,
//   README.md/README.ko.md의 Moderation 섹션 -- 과 동기화 상태인지 검증함.
//   README 자신의 blockquote가 명시하며 사람이 수동으로 맞춰 달라고 요청하는
//   정확히 그 네 곳임.
// 사용처: `pnpm check:config` (루트 스크립트).
// 근거: ARCHITECTURE.md 지속가능성 리뷰에서 이 4곳 미러링에 아무 검증도 없다는
//   걸 발견함, file:line 인용은 이미 check-adr-integrity.mjs가 커버하는 것과
//   달리 -- 이 스크립트는 그 스크립트가 다루지 않는 "인용된 '값' 자체가 실제로
//   재동기화됐는가" 공백을 노림.

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

// tsKey (MODERATION_DEFAULTS에 나오는 그대로) -> 그게 대응하는 env var 이름
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

// ---- 1. 진실 공급원: moderation.constants.ts의 MODERATION_DEFAULTS ----
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

// ---- 2. backend/.env.example: NAME=값 ----
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

// ---- 3. CLAUDE.md: `NAME` (값) ----
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

// ---- 4. README.md / README.ko.md: 나레이티브 프로즈에 원시 초 단위가 아닌
// 사람이 읽는 단위(시간/분/일/횟수)로 박혀 있는 값. 아래 각 패턴은 Moderation
// 섹션의 "현재" 문구에 맞춰져 있음; 그 프로즈가 다시 쓰이면 패턴이 더 이상
// 매치되지 않고 이 체크는 "위치를 못 찾음" 경고를 내지, stale된 데이터를 조용히
// 통과시키지 않음 -- 매치 실패를 "여전히 맞음"으로 절대 간주하지 않음.
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
