// 목적: CHANGELOG.md/.ko.md가 `git log`의 모든 커밋을 올바른 날짜 헤딩 아래
//   나열하는지 검증함 -- 이 둘은 아무도 눈치채기 전에 70개 커밋만큼 벌어졌는데,
//   CHANGELOG.md가 한 번 작성된 뒤 다시 손대지 않은 반면 check:adr은 .ko 짝과
//   헤딩 패리티만 검증했기 때문임.
// 사용처: `pnpm check:changelog` (루트 스크립트); deploy.yml의 test job에
//   연결됨.
// 근거: check-adr-integrity.mjs가 이미 CHANGELOG.md를 `rootPairs`에 포함하지만,
//   오래된 EN 파일과 그만큼 오래된 KO 파일은 그 패리티 체크를 무난히 통과함 --
//   실제 커밋 이력과 대조하는 건 아무것도 없었음.

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

// 얕은 클론(actions/checkout 기본값 fetch-depth: 1)이면 커밋 하나만 놓고
// "통과"해 게이트가 조용히 무력화됨. 워크플로 회귀가 눈에 띄도록 그 대신 즉시
// fail함.
if (git('rev-parse', '--is-shallow-repository').trim() === 'true') {
  fail('git', 'shallow clone -- this check needs full history (set fetch-depth: 0 on actions/checkout)');
  console.error('\nAborted before comparing.');
  process.exit(1);
}

// 커밋 제목에 리터럴 CR 문자가 섞일 수 있음(초기 커밋 3개가 그러함), 그러면
// 한 커밋이 여러 출력 줄로 쪼개짐. "한 줄 = 한 커밋" 가정 대신 NUL로 레코드를
// 구분하고 CR을 제거함.
const rawLog = git('log', '--format=%ad|%s%x00', '--date=short');
const commits = rawLog
  .split('\0')
  .map((chunk) => chunk.replace(/\r/g, '').replace(/^\n+/, ''))
  .filter((chunk) => chunk.trim() !== '')
  .map((chunk) => {
    const idx = chunk.indexOf('|');
    return { date: chunk.slice(0, idx), subject: chunk.slice(idx + 1).trim() };
  });

// `pull_request` 실행에서는 actions/checkout이 그 CI 실행에만 존재하는 합성 머지
// 커밋("Merge <sha> into <sha>")을 만드는데, 이건 절대 체인지로그에 있을 수 없음.
// 무조건 제외함.
const SYNTHETIC_MERGE = /^Merge [0-9a-f]{40} into [0-9a-f]{40}$/;
const realCommits = commits.filter((c) => !SYNTHETIC_MERGE.test(c.subject));

// 실제 머지 커밋은 없어도 되는 걸로 취급하지, 제외하는 게 아님: GitHub의 PR
// 머지("Merge pull request #N from ...")는 main에만 존재하는 반면 이 체인지로그는
// dev에서 관리됨 -- PR/push-to-main 체크아웃은 이걸 보지만 dev 체크아웃은 절대 안
// 봄(PR #12가 #11의 머지 커밋 때문에 CI에서 실패한 걸로 드러남). 실제로 기록된
// 머지 커밋(dev 자체의 과거 머지)은 여전히 정상 매칭되므로 기존 엔트리는 전부
// 그대로 검증됨.
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

  // git 커밋을 날짜별로 묶되 git의 최신순 순서는 유지함.
  const gitByDate = new Map();
  for (const { date, subject } of realCommits) {
    if (!gitByDate.has(date)) gitByDate.set(date, []);
    gitByDate.get(date).push(subject);
  }

  // 체인지로그를 갱신하는 커밋 자신은 자기 제목을 나열할 수 없으므로 가장 최신
  // 커밋은 없어도 허용함. 그보다 오래된 건 전부 진짜 드리프트임: 커밋이 하나 더
  // 쌓이면 이 허용 범위가 기록 안 된 커밋을 더 이상 덮지 못해 체크가 fail함.
  // 최신 커밋을 고를 때는 허용 대상 머지 커밋을 건너뜀: PR/push-to-main
  // 체크아웃에서는 최신 커밋이 머지 커밋 자체라서, 허용 범위가 그 바로 아래
  // 실제 작업 커밋을 계속 커버해야 하기 때문.
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
