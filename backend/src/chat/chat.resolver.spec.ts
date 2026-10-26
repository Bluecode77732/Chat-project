// 목적: receiveMessage 구독이 밴된 구독자에게 새 메시지를 전달하지 않고 끝나는지 검증함.
// 사용처: `pnpm test`(jest)에서 실행 — 다른 곳에서 import하지 않음.
// 근거: 구독의 권한 확인이 시작 시점에만 일어나 밴 이후에도 열린 구독이 메시지를 받았음(2026-10-26 확인).

import { ForbiddenException } from '@nestjs/common';
import { ChatResolver } from './chat.resolver';
import type { ChatService } from './chat.service';
import type { PubSubService } from 'src/graphql/pubsub.service';
import type { SessionCacheService } from 'src/redis/redis.service';
import type { AiService } from 'src/ai/ai.service';
import type { AiRoomService } from 'src/ai/ai-room.service';
import type { ModerationService } from 'src/moderation/moderation.service';
import type { MessageType } from 'src/graphql/message-type.dto';

type Payload = { receiveMessage: MessageType };

function makeSource(messages: string[]) {
  let i = 0;
  return {
    next: jest.fn(() =>
      Promise.resolve(
        i < messages.length
          ? {
              value: {
                receiveMessage: { message: messages[i++] },
              },
              done: false as const,
            }
          : { value: undefined, done: true as const },
      ),
    ),
    return: jest.fn(() =>
      Promise.resolve({ value: undefined, done: true as const }),
    ),
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

async function nextMessage(it: AsyncIterableIterator<Payload>) {
  const result = await it.next();
  return result.done ? undefined : result.value.receiveMessage.message;
}

describe('ChatResolver.receiveMessage', () => {
  const ctx = { req: { user: { id: 7 } } };
  let chatService: { isRoomParticipant: jest.Mock };
  let pubSub: { asyncIterableIterator: jest.Mock };
  let moderationService: { isUserBanned: jest.Mock };
  let resolver: ChatResolver;

  beforeEach(() => {
    chatService = { isRoomParticipant: jest.fn().mockResolvedValue(true) };
    pubSub = { asyncIterableIterator: jest.fn() };
    moderationService = { isUserBanned: jest.fn().mockResolvedValue(false) };
    resolver = new ChatResolver(
      chatService as unknown as ChatService,
      pubSub as unknown as PubSubService,
      {} as unknown as SessionCacheService,
      {} as unknown as AiService,
      {} as unknown as AiRoomService,
      moderationService as unknown as ModerationService,
    );
  });

  it('rejects a user who is not a participant of the room', async () => {
    chatService.isRoomParticipant.mockResolvedValue(false);

    await expect(resolver.receiveMessage(1, ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('delivers messages while the subscriber is not banned', async () => {
    pubSub.asyncIterableIterator.mockReturnValue(makeSource(['a', 'b']));

    const iterator = (await resolver.receiveMessage(
      1,
      ctx,
    )) as AsyncIterableIterator<Payload>;

    expect(await nextMessage(iterator)).toBe('a');
    expect(await nextMessage(iterator)).toBe('b');
    expect(moderationService.isUserBanned).toHaveBeenCalledWith(7);
  });

  it('ends the subscription without delivering the message once the subscriber is banned', async () => {
    const source = makeSource(['before ban', 'after ban']);
    pubSub.asyncIterableIterator.mockReturnValue(source);
    moderationService.isUserBanned
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    const iterator = (await resolver.receiveMessage(
      1,
      ctx,
    )) as AsyncIterableIterator<Payload>;

    expect(await nextMessage(iterator)).toBe('before ban');
    expect(await iterator.next()).toEqual({ value: undefined, done: true });
    expect(source.return).toHaveBeenCalledTimes(1);
    // 끝난 뒤에는 원본 반복자를 더 읽지 않음
    expect(await iterator.next()).toEqual({ value: undefined, done: true });
    expect(source.next).toHaveBeenCalledTimes(2);
  });

  it('forwards return() to the source even while a next() is still pending', async () => {
    const source = makeSource([]);
    source.next.mockReturnValue(new Promise(() => undefined));
    pubSub.asyncIterableIterator.mockReturnValue(source);

    const iterator = (await resolver.receiveMessage(
      1,
      ctx,
    )) as AsyncIterableIterator<Payload>;
    void iterator.next();

    await iterator.return?.();

    expect(source.return).toHaveBeenCalledTimes(1);
  });
});
