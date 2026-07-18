// Purpose: initializes the Sentry SDK before any other application code loads, per Sentry's
//   documented requirement that instrumentation must be set up before other modules are required.
// Usage: imported as the literal first line of main.ts; no other file should import this.
// Rationale: Sentry.init() must run before NestFactory/AppModule pull in the rest of the app, or
//   its auto-instrumentation patches won't be applied before those modules are first loaded.

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

// Optional integration, same shape as MailModule (backend/src/mail/mail.service.ts): no-ops
// cleanly when SENTRY_DSN is unset, so local dev/CI never needs a Sentry account.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Error tracking only — performance/tracing is out of scope for this integration.
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
