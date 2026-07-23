// Purpose: isolates the liveness endpoint as its own module, matching the
// codebase's one-module-per-concern convention.
// Usage: imported once by AppModule; not intended to export anything.
// Rationale: HealthController has no service/provider dependencies, so it
// doesn't belong inside any existing domain module (chat/auth/user/etc.).

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
