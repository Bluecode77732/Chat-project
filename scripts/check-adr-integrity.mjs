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

function checkMarkdownLinks(adrFile, content) {
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

function extractNearbySymbols(precedingText) {
  const windowStart = Math.max(0, precedingText.length - 300);
  const symbols = new Set();
  for (const spanMatch of precedingText.matchAll(/`([^`]+)`/g)) {
    if (spanMatch.index < windowStart) continue;
    const span = spanMatch[1];
    if ((span.includes('.ts:') || span.includes('.tsx:')) && /[0-9]/.test(span)) continue;
    if (span.includes(' ') && !/[(){}._]/.test(span)) continue;
    for (const token of span.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      if (token[0].length >= 4) symbols.add(token[0]);
    }
  }
  return [...symbols];
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

    const symbols = extractNearbySymbols(content.slice(0, m.index));
    if (symbols.length === 0) continue;

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

const adrFiles = readdirSync(adrDir).filter(
  (f) => /^\d{4}-.*\.md$/.test(f) && f !== 'README.md',
);

for (const file of adrFiles) {
  const fullPath = join(adrDir, file);
  const fileContent = readText(fullPath);
  checkMarkdownLinks(fullPath, fileContent);
  checkFileLineCitations(fullPath, fileContent);
  checkTranslationPair(file);
}

// CLAUDE.md is the top of this repos doc hierarchy (every ADR formalizes something
// from it) and is loaded into every future agent session, so its own citations get
// the same link/anchor and file:line checks as the ADR set. It has no .ko.md
// counterpart by design, so checkTranslationPair does not apply here.
const extraDocs = ['CLAUDE.md'];
for (const relPath of extraDocs) {
  const fullPath = join(repoRoot, relPath);
  const fileContent = readText(fullPath);
  checkMarkdownLinks(fullPath, fileContent);
  checkFileLineCitations(fullPath, fileContent);
}

const totalChecked = adrFiles.length + extraDocs.length;
console.log(`
Checked ${totalChecked} file(s) (${adrFiles.length} ADR + ${extraDocs.length} other). ${errorCount} error(s), ${warnCount} warning(s).`);
process.exit(errorCount > 0 ? 1 : 0);