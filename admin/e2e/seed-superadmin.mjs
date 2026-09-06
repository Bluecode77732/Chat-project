// 목적: admin e2e 테스트용 superadmin 계정을 시딩/갱신함 — 앱 안의 어떤 흐름으로도
// 생성 불가(CLAUDE.md의 Role Population Invariants 참고).
// 사용처: 저장소 루트에서 `pnpm --filter admin e2e` 실행 전에 `pnpm --filter admin
// e2e:seed`로 실행 — 로컬(e2e/.env 읽음)과 CI(job 레벨 env를 직접 읽음) 모두에서 사용.
// 근거: 로컬 개발과 CI가 공유하므로 시딩 로직이 딱 한 곳에만 존재함.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// 두 파일 다 로컬 실행에서만 존재함 — CI는 DB_*와 E2E_SUPERADMIN_*을 job env로 직접
// 공급하므로 여기서는 no-op.
for (const envFile of ['../backend/.env', './e2e/.env']) {
    try {
        process.loadEnvFile(envFile);
    } catch {
        // 파일 없음 — 위 설명대로 정상
    }
}

const email = process.env.E2E_SUPERADMIN_EMAIL;
const password = process.env.E2E_SUPERADMIN_PASSWORD;
if (!email || !password) {
    throw new Error(
        'E2E_SUPERADMIN_EMAIL / E2E_SUPERADMIN_PASSWORD are not set — copy e2e/.env.example to e2e/.env and fill in a superadmin account.',
    );
}

const __dirname = dirname(fileURLToPath(import.meta.url));
// backend의 의존성 트리를 그대로 따라 bcrypt/pg를 resolve함 — 이 스크립트는 자체
// 의존성이 없고, 실행 중인 backend가 이미 갖고 있는 걸 재사용함.
const backendRequire = createRequire(join(__dirname, '../../backend/'));
const bcrypt = backendRequire('bcrypt');
const { Client } = backendRequire('pg');

const hash = await bcrypt.hash(password, 10);

const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE ?? 'postgres',
});
await client.connect();
try {
    await client.query(
        `INSERT INTO user_entity (email, password, role, "isAI")
         VALUES ($1, $2, 2, false)
         ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role`,
        [email, hash],
    );
    console.log(`Seeded superadmin: ${email}`);
} finally {
    await client.end();
}
