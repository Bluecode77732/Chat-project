// 목적: 다른 애플리케이션 코드가 로드되기 전에 Sentry SDK를 초기화 — instrumentation은
//   다른 모듈이 require되기 전에 설정되어야 한다는 Sentry의 공식 요구사항을 따름.
// 사용처: main.ts의 첫 줄로 import됨; 다른 파일에서는 이 파일을 import하면 안 됨.
// 근거: Sentry.init()은 NestFactory/AppModule이 나머지 앱을 끌어오기 전에 실행되어야
//   함 — 그렇지 않으면 해당 모듈들이 처음 로드될 때 auto-instrumentation 패치가 적용되지 않음.

import * as Sentry from '@sentry/nestjs';

const SENSITIVE_FIELD_PATTERN = /password|token|secret/i;

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrub);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_FIELD_PATTERN.test(key)
        ? '[Filtered]'
        : scrub(val);
    }
    return result;
  }
  return value;
}

// MailModule(backend/src/mail/mail.service.ts)과 동일한 형태의 선택적 통합 — SENTRY_DSN이
// 없으면 깔끔하게 no-op되므로 로컬 dev/CI에서는 Sentry 계정이 필요 없음.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // 에러 트래킹 전용 — 성능/트레이싱은 이 통합의 범위 밖.
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request?.data) {
        event.request.data = scrub(event.request.data);
      }
      if (event.extra) {
        event.extra = scrub(event.extra) as typeof event.extra;
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
          ...breadcrumb,
          data: breadcrumb.data
            ? (scrub(breadcrumb.data) as typeof breadcrumb.data)
            : breadcrumb.data,
        }));
      }
      return event;
    },
  });
}
