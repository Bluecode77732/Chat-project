// Purpose: liveness endpoint for Railway's healthcheckPath — confirms the process
// is up and accepting requests, independent of DB/Redis availability.
// Usage: GET /health, called by Railway's deploy-time and runtime health checks.
// Rationale: no controller in the app answered an unauthenticated, dependency-free
// request; Railway had no way to detect a hung-but-alive process before this.

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('health')
@ApiTags('Health API')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Liveness check',
    description:
      'Returns 200 if the process is up and accepting requests. Does not check DB/Redis — a dependency outage should not force a container restart.',
  })
  @ApiResponse({ status: 200, description: 'Process is alive.' })
  check() {
    return { status: 'ok' };
  }
}
