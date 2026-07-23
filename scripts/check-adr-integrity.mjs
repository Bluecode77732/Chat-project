// Purpose: catches ADR documentation rot -- broken cross-links/anchors, missing
//   en/ko translation pairs, citations pointing at files that no longer exist,
//   and (heuristically) citations whose cited line no longer matches the symbol
//   named nearby in the prose.
// Usage: `pnpm check:adr` (root script); wired into CI's `test` job.
// Rationale: an ADR gap review found two rotted citations with nothing to catch
//   them; a follow-up pass found the fix for the underlying content-drift case
//   (a stale line number pointing at a real file, in range, but wrong content)
//   was explicitly rejected as a plain existence/range check, since none of the
//   5 real errors found that session would have been caught by one. This scripts
//   nearby-symbol check targets exactly that gap. It is heuristic (regex-based
//   symbol extraction, not a real parser) so it only ever warns, never fails --
//   a false "broken" verdict here would be worse than no check at all.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const adrDir = join(repoRoot, 'ADR');

let errorCount = 0;
let warnCount = 0;
// Every citation gets an existence + line-range check. Only some additionally get the
// content check, which needs a usable symbol named on the citation's own line. Reporting
// that split matters: without it, "0 warnings" reads as "every citation was verified",
// when in practice roughly a third reach the content check -- the rest are structurally
// sound but unverified against what the cited lines actually say.
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

// Blanks out fenced blocks and inline code spans, preserving length so error offsets and
// line numbers still line up. Link-shaped text inside backticks is an EXAMPLE of a link,
// not a link -- this file's own README documents a deliberately-broken link that way, and
// without this the checker flags its own documentation. Citation checks deliberately do
// NOT use this, since `file.ts:NN` citations live inside backticks by convention.
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

// Collects backticked symbols from the SAME LINE as the citation only. An earlier
// version used a 300-char window, which reached back across sentence and bullet
// boundaries and pulled in symbols belonging to a neighbouring claim -- e.g. warning
// that `RateLimitGuard` was absent near rate-limit.guard.ts:70-82 when the class name
// had bled in from the previous bullet and the citation itself was correct. Same-line
// scoping matches the prevailing "`symbol` (`file.ts:NN`)" style; when a citation wraps
// onto its own line no symbols are found and the check simply skips (see caller).
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

// True when `symbol` is declared at file scope in `fileText` (class, interface, type,
// enum, function, const/let, or a class method). Such a name tells you which construct
// the citation belongs to, not where in the file to look -- naming the enclosing class
// next to a line citation is normal style, so its distance from the cited line carries
// no drift signal and must not be treated as evidence of one.
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
    // Keep only symbols that (a) actually occur somewhere in the cited file and
    // (b) are not that file's own declarations. (a) drops names belonging to another
    // file -- a caller, or an analogous pattern elsewhere -- which say nothing about
    // where to look in THIS file (e.g. `ChatGateway.handleConnection()` named beside a
    // `chat.service.ts` citation). (b) drops the enclosing class/method, whose distance
    // from the cited line is meaningless. What survives is a symbol that lives in this
    // file, so "is it where the doc says it is?" becomes a real question -- and a
    // no-answer is genuine drift, which is how the stale USER_UNBAN citation surfaced.
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
      const from = Math.max(0, range.start - 4); // -1 for 0-index, -3 for context lines
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

// Compares heading STRUCTURE (count + nesting level, in document order)
// between an EN file and its .ko.md translation. Heading TEXT can't be
// compared across languages, so the level sequence is the closest available
// proxy for "a whole section was added to one side and not the other" --
// drift checkTranslationPair cannot see once both files already exist (it
// only checks the counterpart file exists, not that its structure matches).
// Heuristic, so it only ever warns, matching this script's existing policy
// (see file header) that a false "broken" verdict is worse than no check.
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

// A link like [ADR 0016](ADR/0016-....md) states the same number twice. Copying such a
// link and editing only one half silently retargets it, and both halves still look
// plausible in isolation -- so cross-check that the number in the link TEXT matches the
// number in the link PATH. Applies to any file, since ARCHITECTURE.md and CLAUDE.md
// cite ADRs this way too.
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

// The number in an ADR's filename and the number in its own `# NNNN: ...` heading are
// two independent claims about which record this is; a renamed or copy-pasted file can
// leave them disagreeing, which breaks every cross-reference that trusts either one.
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

// CLAUDE.md is the top of this repos doc hierarchy (every ADR formalizes something
// from it) and is loaded into every future agent session, so its own citations get
// the same link/anchor and file:line checks as the ADR set. It has no .ko.md
// counterpart by design, so checkTranslationPair does not apply here.
// ARCHITECTURE.md is included here for link/number checks only: it is the heaviest
// consumer of ADR cross-links in the repo (far more than CLAUDE.md), so a mismatched
// ADR number is most likely to appear there.
const extraDocs = ['CLAUDE.md', 'ARCHITECTURE.md', 'ARCHITECTURE.ko.md', 'ADR/README.md', 'ADR/README.ko.md'];
for (const relPath of extraDocs) {
  const fullPath = join(repoRoot, relPath);
  if (!existsSync(fullPath)) continue;
  const fileContent = readText(fullPath);
  checkMarkdownLinks(fullPath, fileContent);
  checkFileLineCitations(fullPath, fileContent);
  checkAdrLinkNumbers(fullPath, fileContent);
}

// Root-level docs with a full en/ko pair (unlike CLAUDE.md, which has none by
// design). checkHeadingParity only needs both paths to exist -- reuse it here
// rather than adding a parallel root-specific mechanism.
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