// Purpose: fails `pnpm test` if a migration at/after the CASCADE was established re-adds a
//   cascade-critical FK with the wrong ON DELETE action — guards the documented
//   room_participants CASCADE trap (CLAUDE.md § Database, "Generated-migration review").
// Usage: run automatically by Jest; no direct import. Add a new entry to GUARDED_FKS below
//   when another cascade FK becomes subject to the same generated-diff revert.
// Rationale: `migration:generate` silently re-emits FK_501a0aef... as NO ACTION, reverting
//   the CASCADE UserService.remove depends on; the ESLint step is non-blocking (`|| true`),
//   so this text-level gate rides the already-blocking test suite instead.

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface GuardedFk {
  // TypeORM-generated constraint name.
  constraint: string;
  // The ON DELETE action every up() from `since` onward must preserve.
  requiredAction: string;
  // Migration timestamp at which this action became the invariant. Earlier migrations
  // (which set the original NO ACTION) are exempt — the trap is a *later* revert.
  since: number;
}

// M2M join-table onDelete is ignored by migration:generate, so FK_501 is the recurring
// offender. Extend this list if a new cascade FK becomes subject to the same revert.
const GUARDED_FKS: GuardedFk[] = [
  {
    // room_entity_participants_user_entity.userEntityId — CASCADE since
    // FixUserDeleteCascade1749700000000; UserService.remove relies on it.
    constraint: 'FK_501a0aef55632e3cf2894bda97f',
    requiredAction: 'ON DELETE CASCADE',
    since: 1749700000000,
  },
];

describe('migration FK cascade guard', () => {
  const migrationsDir = __dirname;
  const files = readdirSync(migrationsDir).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'),
  );

  it.each(files)('%s keeps guarded FKs intact in up()', (file) => {
    const timestamp = Number(file.split('-')[0]);
    if (Number.isNaN(timestamp)) return; // not a timestamped migration

    const source = readFileSync(join(migrationsDir, file), 'utf8');

    // Scan only up() — down() legitimately restores the prior ON DELETE action.
    const upStart = source.search(/async up\s*\(/);
    if (upStart === -1) return; // not a migration file
    const downStart = source.search(/async down\s*\(/);
    const upBody = source.slice(
      upStart,
      downStart === -1 ? source.length : downStart,
    );

    const violations: string[] = [];
    for (const fk of GUARDED_FKS) {
      if (timestamp < fk.since) continue; // predates the invariant — original state is fine
      for (const line of upBody.split('\n')) {
        if (
          line.includes(`ADD CONSTRAINT "${fk.constraint}"`) &&
          !line.includes(fk.requiredAction)
        ) {
          violations.push(
            `${file}: up() re-adds ${fk.constraint} without "${fk.requiredAction}". This ` +
              `reverts the cascade UserService.remove depends on — strip the auto-generated ` +
              `FK drop/re-add lines (CLAUDE.md § Database, "Generated-migration review").`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
