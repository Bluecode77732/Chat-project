// 목적: Railway의 healthcheckPath용 liveness 엔드포인트 — DB/Redis 가용성과 무관하게
// 프로세스가 살아서 요청을 받고 있는지만 확인.
// 사용처: GET /health, Railway의 배포 시점 및 런타임 헬스체크가 호출.
// 근거: 인증 없이 의존성 없이 응답하는 컨트롤러가 앱에 없었음 — 이전에는 Railway가
// 멈췄지만 살아있는 프로세스를 감지할 방법이 없었음.

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
