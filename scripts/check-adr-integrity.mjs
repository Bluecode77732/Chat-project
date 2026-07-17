// Purpose: catches ADR documentation rot — broken cross-links/anchors, missing
//   en/ko translation pairs, and citations pointing at files that no longer exist.
// Usage: `pnpm check:adr` (root script); intended to run locally and, once proven
//   stable, as a CI step alongside `pnpm lint`.
// Rationale: an ADR gap review found two already-rotted citations (a renamed
//   ARCHITECTURE.md anchor, an understated module-dependency description) with no
//   mechanism that would have caught either — this script is that mechanism.

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

// Normalizes CRLF -> LF so per-line regexes anchored with `$` work regardless of
// the file's line-ending style (this repo's docs are CRLF, source files are LF).
function readText(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

// GitHub-style heading slug (approximate): lowercase, strip markdown/punctuation
// (keeping unicode word chars, spaces, hyphens), then spaces -> hyphens.
function slugify(heading) {
  return heading
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
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
    if (/^https?:\/\//.test(target)) continue; // external links out of scope

    const [pathPart, anchor] = target.split('#');
    if (!pathPart) continue; // pure in-file anchor, e.g. "#foo" — skip (self-file, low risk)

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

// Finds a file by basename anywhere under repoRoot (excluding node_modules/dist/.git),
// used because ADR citations sometimes use a bare filename without its directory path.
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

function checkFileLineCitations(adrFile, content) {
  // Matches `path/to/file.ts:12` or `file.ts:12-34` inside backticks.
  const citationPattern = /`([\w./-]+\.tsx?):(\d+)(?:-(\d+))?`/g;
  let m;
  while ((m = citationPattern.exec(content))) {
    const [, citedPath, startLine] = m;
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
        `bare filename "${citedPath}" matches ${candidates.length} files — citation is ambiguous, prefer a path`,
      );
    }

    const target = candidates[0];
    const lineCount = readText(target).split('\n').length;
    if (Number(startLine) > lineCount) {
      warn(
        relative(repoRoot, adrFile),
        `citation ${citedPath}:${startLine} exceeds file length (${lineCount} lines) — likely stale`,
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
  const content = readText(fullPath);
  checkMarkdownLinks(fullPath, content);
  checkFileLineCitations(fullPath, content);
  checkTranslationPair(file);
}

console.log(
  `\nChecked ${adrFiles.length} ADR file(s). ${errorCount} error(s), ${warnCount} warning(s).`,
);
process.exit(errorCount > 0 ? 1 : 0);
