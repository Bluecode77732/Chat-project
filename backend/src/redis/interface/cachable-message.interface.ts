// 목적: Redis 캐시 작성자와 이를 호출하는 GraphQL publisher 간의 캐시 메시지 계약을 공유.
// 사용처: SessionCacheService(redis.service.ts)와 PubSubService(graphql/pubsub.service.ts)에서 임포트.
// 근거: 이전엔 redis.service.ts에 인라인이었으나, 정의 파일 밖에서 쓰이는 유일한 redis 인터페이스라 분리.

import type { UserEntity } from 'src/user/entities/user.entity';

export interface CachableMessage {
  id?: number;
  message?: string;
  created?: Date | string;
  participant?: Partial<UserEntity> | Record<string, unknown>;
}
