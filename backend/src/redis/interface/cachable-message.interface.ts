// Purpose: shares the cache-message contract between the Redis cache writer and its GraphQL publisher caller.
// Usage: imported by SessionCacheService (redis.service.ts) and PubSubService (graphql/pubsub.service.ts).
// Rationale: previously inlined in redis.service.ts; extracted since it's the only redis interface consumed outside its defining file.

import type { UserEntity } from 'src/user/entities/user.entity';

export interface CachableMessage {
  id?: number;
  message?: string;
  created?: Date | string;
  participant?: Partial<UserEntity> | Record<string, unknown>;
}
