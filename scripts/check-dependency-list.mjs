// 목적: README.md의 "Total Installation" Dependencies/DevDependencies
//   목록(이름 하나하나와 "(N)" 개수)이 backend/package.json과 일치하는지
//   검증함 -- 문서화 작업 한 번에 두 번이나 어긋났는데, 순전히 둘을 서로
//   대조하는 게 아무것도 없었기 때문임.
// 사용처: `pnpm check:deps` (루트 스크립트).
// 근거: 함께 추가된 지속가능성 체크들(check-config-values.mjs,
//   check-adr-integrity.mjs의 헤딩 패리티 체크) 중 위험도가 가장 낮음 --
//   package.json에 대한 순수 집합 diff라 틀릴 만한 휴리스틱도 없고 오탐
//   위험도 없음. 그래서 불일치 시 warn이 아니라 fail함.

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

// `header`와 일치하는 줄에서 시작해 첫 빈 줄까지 이어지는 레이블된 불릿
// 목록("Dependencies (44)" / "- pkg-name ...")을 추출함. 불릿 뒤에 붙는 부연
// 설명("- ts-jest (custom jest config)")은 제거함 -- 이 스크립트가
// package.json과 대조할 수 있는 주장은 맨 앞 패키지명뿐이기 때문.
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
