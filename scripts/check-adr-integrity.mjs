// 목적: ADR 문서 부패 감지 -- 깨진 상호 링크/앵커, 누락된 en/ko 번역 짝,
//   더는 존재하지 않는 파일을 가리키는 인용, 그리고 (휴리스틱하게) 인용된
//   줄이 근처 프로즈에 언급된 심볼과 더 이상 일치하지 않는 경우.
// 사용처: `pnpm check:adr` (루트 스크립트); CI `test` job에 연결됨.
// 근거: ADR 갭 리뷰에서 아무것도 못 잡는 부패 인용 2건을 발견함; 후속
//   조사에서 근본 원인인 콘텐츠 드리프트 케이스(실제 파일을 가리키고 범위
//   내지만 내용이 틀린 stale 줄 번호)의 해법으로 단순 존재/범위 체크는
//   명시적으로 기각함 -- 그 세션에서 나온 실제 오류 5건 중 단순 체크로
//   잡히는 게 하나도 없었음. 이 스크립트의 근처-심볼 체크가 정확히 그
//   공백을 노림. 정규식 기반 심볼 추출이라 진짜 파서가 아니므로 휴리스틱임
//   -- 그래서 항상 warn만 하고 절대 fail하지 않음. 잘못된 "broken" 판정은
//   체크 자체가 없는 것보다 나쁨.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const adrDir = join(repoRoot, 'ADR');

let errorCount = 0;
let warnCount = 0;
// 모든 인용은 존재/줄범위 체크를 받음. 그중 일부만 추가로 콘텐츠 체크를 받는데,
// 인용된 줄 자체에 사용 가능한 심볼이 있어야 하기 때문임. 이 구분을 보고하는
// 게 중요함 -- 안 그러면 "경고 0건"이 "모든 인용이 검증됨"으로 읽히는데, 실제로는
// 약 1/3만 콘텐츠 체크에 도달함 -- 나머지는 구조적으로는 문제없지만 인용된 줄의
// 실제 내용과 대조 검증되지 않은 상태임.
let contentChecked = 0;
let contentSkipped = 0;

function fail(file, msg) {
  console.error(`✗ ${file}: ${msg}`);
  errorCount++;
}

function warn(file, msg) {
  console.warn(`~ ${file}: ${msg}`);
  warnCount++;
}

function readText(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

function slugify(heading) {
  return heading
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

function headingSlugsIn(filePath) {
  if (!existsSync(filePath)) return null;
  const content = readText(filePath);
  const slugs = new Set();
  for (const line of content.split('\n')) {
    const m = /^#{1,6}\s+(.*)$/.exec(line);
    if (m) slugs.add(slugify(m[1]));
  }
  return slugs;
}

// 펜스 코드 블록과 인라인 코드 스팬을 공백으로 지우되 길이는 보존해 에러 오프셋과
// 줄 번호가 어긋나지 않게 함. 백틱 안의 링크 모양 텍스트는 링크의 "예시"이지 실제
// 링크가 아님 -- 이 저장소 README가 의도적으로 깨진 링크를 그런 식으로 예시하는데,
// 이 처리 없이는 체커가 자기 문서를 오탐함. 인용 체크는 일부러 이 함수를 쓰지
// 않음, `file.ts:NN` 인용은 관례상 백틱 안에 있기 때문.
function stripCodeSpans(text) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  return text
    .replace(/```[\s\S]*?```/g, blank)
    .replace(/`[^`\n]*`/g, blank);
}

function checkMarkdownLinks(adrFile, content) {
  content = stripCodeSpans(content);
  const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = linkPattern.exec(content))) {
    const target = m[2];
    if (/^https?:\/\//.test(target)) continue;

    const [pathPart, anchor] = target.split('#');
    if (!pathPart) continue;

    const resolvedPath = resolve(dirname(adrFile), pathPart);
    if (!existsSync(resolvedPath)) {
      fail(relative(repoRoot, adrFile), `broken link -> ${target}`);
      continue;
    }
    if (anchor && resolvedPath.endsWith('.md')) {
      const slugs = headingSlugsIn(resolvedPath);
      if (slugs && !slugs.has(anchor)) {
        fail(
          relative(repoRoot, adrFile),
          `anchor "#${anchor}" not found in ${relative(repoRoot, resolvedPath)}`,
        );
      }
    }
  }
}

let fileIndexCache = null;
function findByBasename(basename) {
  if (!fileIndexCache) {
    fileIndexCache = new Map();
    const skip = new Set(['node_modules', 'dist', '.git', '.next', 'coverage']);
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else {
          const list = fileIndexCache.get(entry.name) ?? [];
          list.push(full);
          fileIndexCache.set(entry.name, list);
        }
      }
    };
    walk(repoRoot);
  }
  return fileIndexCache.get(basename) ?? [];
}

function parseLineSpec(spec) {
  return spec.split(',').map((part) => {
    const [a, b] = part.split('-').map(Number);
    return { start: a, end: b ?? a };
  });
}

// 인용문과 "같은 줄"에서만 백틱 심볼을 수집함. 이전 버전은 300자 윈도우를 썼는데
// 문장/불릿 경계를 넘어가 인접한 주장에 속한 심볼을 끌어옴 -- 예를 들어 클래스명이
// 이전 불릿에서 흘러들어와, 실제로는 정상인 rate-limit.guard.ts:70-82 인용 근처에
// `RateLimitGuard`가 없다고 경고한 사례. 같은 줄로 범위를 제한하는 게 우세한
// "`symbol` (`file.ts:NN`)" 스타일과 맞아떨어짐; 인용이 자기 줄로 줄바꿈되면 심볼이
// 안 잡히고 체크는 그냥 건너뜀 (호출부 참고).
function extractNearbySymbols(precedingText) {
  const lineStart = precedingText.lastIndexOf('\n') + 1;
  const sameLine = precedingText.slice(lineStart);
  const symbols = new Set();
  for (const spanMatch of sameLine.matchAll(/`([^`]+)`/g)) {
    const span = spanMatch[1];
    if ((span.includes('.ts:') || span.includes('.tsx:')) && /[0-9]/.test(span)) continue;
    if (span.includes(' ') && !/[(){}._]/.test(span)) continue;
    for (const token of span.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      if (token[0].length >= 4) symbols.add(token[0]);
    }
  }
  return [...symbols];
}

// `symbol`이 `fileText`에서 파일 스코프로 선언됐는지 확인함 (클래스, 인터페이스,
// 타입, enum, 함수, const/let, 클래스 메서드). 이런 이름은 인용이 어떤 구성 요소에
// 속하는지만 알려줄 뿐 파일 안 어디를 봐야 하는지는 알려주지 않음 -- 줄 인용 옆에
// 감싸는 클래스명을 적는 건 흔한 스타일이라 인용된 줄과의 거리가 드리프트 신호가
// 될 수 없고 그렇게 취급해서도 안 됨.
function isDeclaredInFile(symbol, fileText) {
  const s = symbol.replace(/[$]/g, '\\$');
  const patterns = [
    new RegExp(`\\b(?:class|interface|type|enum)\\s+${s}\\b`),
    new RegExp(`\\b(?:function|const|let|var)\\s+${s}\\b`),
    new RegExp(`^\\s*(?:private\\s+|public\\s+|protected\\s+|readonly\\s+|static\\s+)*(?:async\\s+)?${s}\\s*\\(`, 'm'),
  ];
  return patterns.some((re) => re.test(fileText));
}

function checkFileLineCitations(adrFile, content) {
  const citationPattern = /`([\w./-]+\.tsx?):(\d+(?:[,-]\d+)*)`/g;
  let m;
  while ((m = citationPattern.exec(content))) {
    const [full, citedPath, lineSpec] = m;
    const basename = citedPath.split('/').pop();
    let candidates;
    if (citedPath.includes('/')) {
      const direct = resolve(repoRoot, citedPath);
      candidates = existsSync(direct) ? [direct] : [];
    } else {
      candidates = findByBasename(basename);
    }

    if (candidates.length === 0) {
      fail(relative(repoRoot, adrFile), `citation references missing file: ${citedPath}`);
      continue;
    }
    if (candidates.length > 1 && !citedPath.includes('/')) {
      warn(
        relative(repoRoot, adrFile),
        `bare filename "${citedPath}" matches ${candidates.length} files -- citation is ambiguous, prefer a path`,
      );
    }

    const target = candidates[0];
    const lines = readText(target).split('\n');
    const ranges = parseLineSpec(lineSpec);

    for (const range of ranges) {
      if (range.start > lines.length) {
        warn(
          relative(repoRoot, adrFile),
          `citation ${citedPath}:${range.start} exceeds file length (${lines.length} lines) -- likely stale`,
        );
      }
    }

    const fileText = lines.join('\n');
    // (a) 실제로 인용된 파일 안에 존재하고 (b) 그 파일 자신의 선언은 아닌 심볼만
    // 남김. (a)는 다른 파일에 속한 이름 -- 호출자나 다른 곳의 유사 패턴 -- 을
    // 걸러냄, 이런 이름은 "이 파일" 안 어디를 봐야 하는지와 무관함 (예:
    // `chat.service.ts` 인용 옆에 적힌 `ChatGateway.handleConnection()`). (b)는
    // 감싸는 클래스/메서드를 걸러냄, 인용된 줄과의 거리가 무의미하기 때문. 남는 건
    // 이 파일에 실제로 존재하는 심볼이라 "문서가 말하는 위치에 있는가?"가 진짜
    // 질문이 되고, 답이 없으면 진짜 드리프트임 -- 실제로 이 방식으로 stale된
    // USER_UNBAN 인용을 찾아냈음.
    const symbols = extractNearbySymbols(content.slice(0, m.index)).filter(
      (s) => fileText.includes(s) && !isDeclaredInFile(s, fileText),
    );
    if (symbols.length === 0) {
      contentSkipped++;
      continue;
    }
    contentChecked++;

    const matchesAnyRange = ranges.some((range) => {
      if (range.start > lines.length) return true;
      const from = Math.max(0, range.start - 4); // -1은 0-인덱스 보정, -3은 컨텍스트 줄
      const to = Math.min(lines.length, range.end + 2);
      const windowText = lines.slice(from, to).join('\n');
      return symbols.some((s) => windowText.includes(s));
    });

    if (!matchesAnyRange) {
      warn(
        relative(repoRoot, adrFile),
        `citation ${full} -- none of nearby symbols [${symbols.join(', ')}] found near ${citedPath}:${lineSpec} -- possible content drift, re-verify by hand`,
      );
    }
  }
}

function checkTranslationPair(file) {
  const isKo = file.endsWith('.ko.md');
  const counterpart = isKo
    ? file.replace(/\.ko\.md$/, '.md')
    : file.replace(/\.md$/, '.ko.md');
  if (!existsSync(join(adrDir, counterpart))) {
    fail(file, `missing translation pair: ${counterpart}`);
  }
}

function headingOutlineIn(filePath) {
  if (!existsSync(filePath)) return null;
  const content = readText(filePath);
  const levels = [];
  for (const line of content.split('\n')) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) levels.push(m[1].length);
  }
  return levels;
}

// EN 파일과 .ko.md 번역본 사이의 헤딩 "구조"(개수 + 중첩 레벨, 문서 순서)를
// 비교함. 헤딩 "텍스트"는 언어가 달라 비교 불가능하므로 레벨 시퀀스가 "한쪽에만
// 섹션이 추가됨"을 감지할 수 있는 가장 근접한 대용 지표임 -- 두 파일이 이미
// 존재하는 상태에서 구조만 어긋나는 건 checkTranslationPair가 못 잡음 (그건 짝
// 파일의 존재만 확인하지 구조 일치는 확인 안 함). 휴리스틱이므로 이 스크립트의
// 기존 정책(파일 헤더 참고)대로 항상 warn만 함 -- 잘못된 "broken" 판정이 체크
// 없음보다 나쁨.
function checkHeadingParity(enFile, koFile) {
  const enLevels = headingOutlineIn(enFile);
  const koLevels = headingOutlineIn(koFile);
  if (!enLevels || !koLevels) return;

  if (enLevels.length !== koLevels.length) {
    warn(
      relative(repoRoot, enFile),
      `heading count differs from ${relative(repoRoot, koFile)}: ${enLevels.length} vs ${koLevels.length} -- a section may be missing on one side`,
    );
    return;
  }
  for (let i = 0; i < enLevels.length; i++) {
    if (enLevels[i] !== koLevels[i]) {
      warn(
        relative(repoRoot, enFile),
        `heading #${i + 1} level differs from ${relative(repoRoot, koFile)}: H${enLevels[i]} vs H${koLevels[i]} -- structure has diverged`,
      );
      return;
    }
  }
}

// `[ADR 0016](ADR/0016-....md)` 같은 링크는 같은 번호를 두 번 명시함. 이런 링크를
// 복사해 한쪽만 수정하면 조용히 다른 곳을 가리키게 되는데, 둘 다 따로 보면
// 그럴듯해 보임 -- 그래서 링크 "텍스트"의 번호와 링크 "경로"의 번호가 일치하는지
// 교차 검증함. 모든 파일에 적용됨, ARCHITECTURE.md와 CLAUDE.md도 이 방식으로
// ADR을 인용하기 때문.
function checkAdrLinkNumbers(docFile, content) {
  content = stripCodeSpans(content);
  const pattern = /\[(?:ADR\s*)?(\d{4})\]\(([^)]*?(\d{4})-[^)]*)\)/gi;
  let m;
  while ((m = pattern.exec(content))) {
    const [full, textNum, path, pathNum] = m;
    if (textNum !== pathNum) {
      fail(
        relative(repoRoot, docFile),
        `ADR link number mismatch: ${full} -- text says ${textNum}, path points at ${pathNum} (${path})`,
      );
    }
  }
}

// ADR 파일명의 번호와 자신의 `# NNNN: ...` 헤딩 번호는 이 레코드가 어떤 것인지에
// 대한 두 개의 독립적인 주장임; 이름이 바뀌거나 복붙된 파일은 둘을 어긋나게 둘 수
// 있고, 그러면 둘 중 하나를 신뢰하는 모든 상호 참조가 깨짐.
function checkSelfNumber(file, content) {
  const fileNum = file.slice(0, 4);
  const headingMatch = /^#\s*(\d{4})\s*:/m.exec(content);
  if (!headingMatch) {
    fail(file, 'no `# NNNN: title` heading found');
    return;
  }
  if (headingMatch[1] !== fileNum) {
    fail(
      file,
      `self-number mismatch: filename says ${fileNum}, heading says ${headingMatch[1]}`,
    );
  }
}

const adrFiles = readdirSync(adrDir).filter(
  (f) => /^\d{4}-.*\.md$/.test(f) && f !== 'README.md',
);

for (const file of adrFiles) {
  const fullPath = join(adrDir, file);
  const fileContent = readText(fullPath);
  checkMarkdownLinks(fullPath, fileContent);
  checkFileLineCitations(fullPath, fileContent);
  checkTranslationPair(file);
  checkAdrLinkNumbers(fullPath, fileContent);
  checkSelfNumber(file, fileContent);
  if (!file.endsWith('.ko.md')) {
    checkHeadingParity(fullPath, join(adrDir, file.replace(/\.md$/, '.ko.md')));
  }
}

// CLAUDE.md는 이 저장소 문서 계층의 최상단이고(모든 ADR이 여기서 나온 걸
// 공식화함) 앞으로의 모든 에이전트 세션에 로드되므로, ADR 세트와 같은 링크/앵커,
// file:line 체크를 받음. 설계상 .ko.md 짝이 없어서 checkTranslationPair는 여기
// 적용 안 됨. ARCHITECTURE.md는 링크/번호 체크만 포함함: 저장소에서 ADR 상호
// 링크를 가장 많이 쓰는 문서라(CLAUDE.md보다 훨씬 많음) 번호 불일치가 나타날
// 가능성이 가장 높은 곳임.
const extraDocs = ['CLAUDE.md', 'ARCHITECTURE.md', 'ARCHITECTURE.ko.md', 'ADR/README.md', 'ADR/README.ko.md'];
for (const relPath of extraDocs) {
  const fullPath = join(repoRoot, relPath);
  if (!existsSync(fullPath)) continue;
  const fileContent = readText(fullPath);
  checkMarkdownLinks(fullPath, fileContent);
  checkFileLineCitations(fullPath, fileContent);
  checkAdrLinkNumbers(fullPath, fileContent);
}

// 전체 en/ko 짝을 가진 루트 문서 (CLAUDE.md는 설계상 짝이 없어 제외). checkHeadingParity는
// 두 경로가 존재하기만 하면 되므로 별도의 루트 전용 메커니즘을 추가하는 대신 재사용함.
const rootPairs = ['README.md', 'ARCHITECTURE.md', 'CONTRIBUTING.md', 'ROADMAP.md', 'CHANGELOG.md', 'ADR/README.md'];
for (const relPath of rootPairs) {
  const enPath = join(repoRoot, relPath);
  const koPath = join(repoRoot, relPath.replace(/\.md$/, '.ko.md'));
  checkHeadingParity(enPath, koPath);
}

const totalChecked = adrFiles.length + extraDocs.length;
const totalCitations = contentChecked + contentSkipped;
const pct = totalCitations === 0 ? 0 : Math.round((contentChecked / totalCitations) * 100);
console.log(`
Checked ${totalChecked} file(s) (${adrFiles.length} ADR + ${extraDocs.length} other). ${errorCount} error(s), ${warnCount} warning(s).
Citations: ${totalCitations} checked for existence/range; ${contentChecked} (${pct}%) also content-verified against a named symbol, ${contentSkipped} not (no usable symbol on the citation's line).`);
process.exit(errorCount > 0 ? 1 : 0);