// 목적: CASCADE가 설정된 시점 이후의 마이그레이션이 cascade-critical FK를 잘못된
//   ON DELETE 액션으로 재생성하면 `pnpm test`가 실패하도록 함 — 문서화된
//   room_participants CASCADE 함정을 방지 (CLAUDE.md § Database, "Generated-migration review").
// 사용처: Jest가 자동 실행; 직접 import 없음. 다른 cascade FK가 같은
//   generated-diff revert 문제를 겪게 되면 아래 GUARDED_FKS에 항목을 추가.
// 근거: `migration:generate`가 FK_501a0aef...를 조용히 NO ACTION으로 재생성해서
//   UserService.remove가 의존하는 CASCADE를 되돌려버림; ESLint 단계는 non-blocking
//   (`|| true`)이라 이 텍스트 레벨 가드가 이미 blocking인 테스트 스위트에 얹혀서 동작.

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface GuardedFk {
  // TypeORM이 생성한 constraint 이름.
  constraint: string;
  // `since` 이후의 모든 up()이 유지해야 하는 ON DELETE 액션.
  requiredAction: string;
  // 이 액션이 불변조건이 된 마이그레이션 타임스탬프. 이전 마이그레이션(원래
  // NO ACTION을 설정한 것들)은 예외 — 함정은 *나중의* revert임.
  since: number;
}

// M2M join-table의 onDelete는 migration:generate가 무시하기 때문에 FK_501이 반복적으로
// 문제를 일으킴. 같은 revert 문제를 겪는 새 cascade FK가 생기면 이 목록을 확장.
const GUARDED_FKS: GuardedFk[] = [
  {
    // room_entity_participants_user_entity.userEntityId — CASCADE는
    // FixUserDeleteCascade1749700000000부터; UserService.remove가 이에 의존.
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

    // up()만 스캔 — down()은 이전 ON DELETE 액션을 복원하는 게 정상 동작.
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
