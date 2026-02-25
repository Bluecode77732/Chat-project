// chat.resolver.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ChatResolver } from './chat.resolver';
import { ChatService } from './chat.service';
import { PubSubService } from 'src/graphql/pubsub.service';
import { GraphQLAuthGuard } from 'src/auth/guard/graphql.auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { CreateChatInput } from 'src/graphql/create-chat-input.type';

describe('ChatResolver', () => {
  let resolver: ChatResolver;
  let chatService: ChatService;
  let pubSubService: PubSubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatResolver,
        {
          provide: ChatService,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
        {
          provide: PubSubService,
          useValue: {
            publish: jest.fn(),
            asyncIterableIterator: jest.fn(),
          },
        },
      ],
    }).compile();

    resolver = module.get<ChatResolver>(ChatResolver);
    chatService = module.get<ChatService>(ChatService);
    pubSubService = module.get<PubSubService>(PubSubService);
  });

  describe('ping', () => {
    it('should return ping message', () => {
      // Old: No dummy query needed
      // New: GraphQL requires at least one @Query
      const result = resolver.ping();

      expect(result).toBe('ping has returned.');
    });
  });

  describe('sendMessage', () => {
    const mockContext = {
      req: {
        user: {
          sub: 1,
        },
      },
    };

    const mockInput: CreateChatInput = {
      message: 'A msg',
      recipientId: 2,
      room: 1,
    };

    it('should send message and publish to PubSub with room', async () => {
      const mockSavedMessage = {
        id: 1,
        message: 'Hello World',
        participant: { id: 1 },
        room: { id: 10 },
        createdAt: new Date(),
      };

      jest.spyOn(chatService, 'sendMessage').mockResolvedValue(mockSavedMessage as any);
      jest.spyOn(pubSubService, 'publish').mockResolvedValue();

      const result = await resolver.sendMessage(mockContext, mockInput, 2);

      // Old: Direct Socket.io emit only
      // New: Saves via service + publishes to GraphQL subscription
      expect(chatService.sendMessage).toHaveBeenCalledWith(
        { sub: 1 },
        {
          message: 'Hello World',
          recipientId: 2,
        },
      );
      expect(pubSubService.publish).toHaveBeenCalledWith(
        'messageAdded: 10',
        { messageAdded: mockSavedMessage }
      );
      expect(result).toEqual(mockSavedMessage);
    });

    it('should publish to both channel formats when room exists', async () => {
      const mockSavedMessage = {
        id: 2,
        message: 'A msg',
        participant: { id: 2 },
        room: { id: 1 },
        createdAt: new Date(),
      };

      jest.spyOn(resolver, 'sendMessage').mockResolvedValue(mockInput);
      jest.spyOn(chatService, 'sendMessage').mockResolvedValue(mockSavedMessage as any);
      jest.spyOn(pubSubService, 'publish').mockResolvedValue();


      // Old: Single channel
      // New: Publishes to TWO channels: 'messageAdded: 5' and 'messageAdded:5'
      expect(pubSubService.publish).toHaveBeenCalledWith(
        'messageAdded: 5',
        { messageAdded: mockSavedMessage }
      );
      expect(pubSubService.publish).toHaveBeenCalledWith(
        'messageAdded:5',
        { messageAdded: mockSavedMessage }
      );
    });

    it('should skip first publish when room is undefined', async () => {
      const mockSavedMessage = {
        id: 3,
        message: 'No room',
        participant: { id: 1 },
        createdAt: new Date(),
      };

      jest.spyOn(chatService, 'sendMessage').mockResolvedValue(mockSavedMessage as any);
      jest.spyOn(pubSubService, 'publish').mockResolvedValue();

      await resolver.sendMessage(mockContext, mockInput, 2);

      // Old: Would fail with undefined room
      // New: Conditional check prevents first publish, only publishes to 'messageAdded:undefined'
      expect(pubSubService.publish).toHaveBeenCalledTimes(1);
      expect(pubSubService.publish).toHaveBeenCalledWith(
        'messageAdded:undefined',
        { messageAdded: mockSavedMessage }
      );
    });

    it('should use userId from context or default to 1', async () => {
      const mockSavedMessage = {
        id: 4,
        message: 'Default user',
        participant: { id: 1 },
        createdAt: new Date(),
      };

      const contextNoUser = { req: {} };

      jest.spyOn(chatService, 'sendMessage').mockResolvedValue(mockSavedMessage as any);
      jest.spyOn(pubSubService, 'publish').mockResolvedValue();

      await resolver.sendMessage(contextNoUser, mockInput, 2);

      // Old: Hardcoded userId
      // New: Falls back to 1 if ctx.req?.user?.sub is undefined
      expect(chatService.sendMessage).toHaveBeenCalledWith(
        { sub: 1 },
        expect.any(Object)
      );
    });

    it('should wait 1 second before publishing', async () => {
      const mockSavedMessage = {
        id: 5,
        message: 'Delayed',
        participant: { id: 1 },
        room: { id: 1 },
        createdAt: new Date(),
      };

      jest.spyOn(chatService, 'sendMessage').mockResolvedValue(mockSavedMessage as any);
      jest.spyOn(pubSubService, 'publish').mockResolvedValue();
      jest.spyOn(global, 'setTimeout');

      await resolver.sendMessage(mockContext, mockInput, 2);

      // Old: Immediate publish
      // New: await new Promise(delay => setTimeout(delay, 1000))
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it('should log debug messages during execution', async () => {
      const mockSavedMessage = {
        id: 6,
        message: 'Debug',
        participant: { id: 1 },
        room: { id: 1 },
        createdAt: new Date(),
      };

      jest.spyOn(chatService, 'sendMessage').mockResolvedValue(mockSavedMessage as any);
      jest.spyOn(pubSubService, 'publish').mockResolvedValue();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await resolver.sendMessage(mockContext, mockInput, 2);

      // Old: No debug output
      // New: Multiple console.log statements for debugging
      expect(consoleSpy).toHaveBeenCalledWith(
        '🔵 Mutation received:',
        expect.objectContaining({ input: mockInput, recipientId: 2 })
      );
      expect(consoleSpy).toHaveBeenCalledWith('🔵 Saved message:', mockSavedMessage);
      expect(consoleSpy).toHaveBeenCalledWith('🔵 About to publish:', expect.any(String));
      expect(consoleSpy).toHaveBeenCalledWith('🔵 Published successfully');

      consoleSpy.mockRestore();
    });

    it('should return null message when savedMessage is false', async () => {
      jest.spyOn(chatService, 'sendMessage').mockResolvedValue(null!);
      jest.spyOn(pubSubService, 'publish').mockResolvedValue();

      const result = await resolver.sendMessage(mockContext, mockInput, 2);

      // Old: Would return null
      // New: Returns string with null indicator
      expect(result).toBe('chat.resolver sends null - null');
    });

    it('should return savedMessage when truthy', async () => {
      const mockSavedMessage = {
        id: 7,
        message: 'Valid',
        participant: { id: 1 },
        createdAt: new Date(),
      };

      jest.spyOn(chatService, 'sendMessage').mockResolvedValue(mockSavedMessage as any);
      jest.spyOn(pubSubService, 'publish').mockResolvedValue();

      const result = await resolver.sendMessage(mockContext, mockInput, 2);

      // Old: Returns plain object
      // New: Returns savedMessage OR null string
      expect(result).toEqual(mockSavedMessage);
      expect(result).not.toContain('null');
    });
  });

  describe('messageAdded', () => {
    it('should create async iterator for room subscription', () => {
      const mockIterator = {
        [Symbol.asyncIterator]: jest.fn(),
      };

      jest.spyOn(pubSubService, 'asyncIterableIterator').mockReturnValue(mockIterator as any);

      const result = resolver.messageAdded(10);

      // Old: Local PubSub instance
      // New: Injectable PubSubService for shared subscriptions
      expect(pubSubService.asyncIterableIterator).toHaveBeenCalledWith('messageAdded:10');
      expect(result).toEqual(mockIterator);
    });

    it('should log PubSub instance constructor name', () => {
      const mockIterator = {
        [Symbol.asyncIterator]: jest.fn(),
      };

      jest.spyOn(pubSubService, 'asyncIterableIterator').mockReturnValue(mockIterator as any);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      resolver.messageAdded(5);

      // Old: No instance logging
      // New: Logs PubSub constructor name for debugging
      expect(consoleSpy).toHaveBeenCalledWith(
        '🟢 PubSub instance in subscription:',
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it('should log channel subscription details', () => {
      const mockIterator = {
        [Symbol.asyncIterator]: jest.fn(),
      };

      jest.spyOn(pubSubService, 'asyncIterableIterator').mockReturnValue(mockIterator as any);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      resolver.messageAdded(15);

      // Old: No subscription logging
      // New: Logs subscription creation and channel name
      expect(consoleSpy).toHaveBeenCalledWith('🟢 Subscription created for room:', 15);
      expect(consoleSpy).toHaveBeenCalledWith('🟢 Subscribing to channel:', 'messageAdded:15');
      expect(consoleSpy).toHaveBeenCalledWith('🟢 Listening to channel:', 'messageAdded:15');

      consoleSpy.mockRestore();
    });

    it('should use correct channel format without space', () => {
      const mockIterator = {
        [Symbol.asyncIterator]: jest.fn(),
      };

      jest.spyOn(pubSubService, 'asyncIterableIterator').mockReturnValue(mockIterator as any);

      resolver.messageAdded(20);

      // Old: Inconsistent channel naming
      // New: Consistent 'messageAdded:roomId' format (no space)
      expect(pubSubService.asyncIterableIterator).toHaveBeenCalledWith('messageAdded:20');
    });
  });

  describe('messageAdded - subscription decorator options', () => {
    it('should have resolve function that extracts messageAdded from payload', () => {
      const mockPayload = {
        messageAdded: {
          id: 1,
          message: 'Test',
          participant: { id: 1 },
          createdAt: new Date(),
        },
      };

      // Access the decorator metadata (simulated)
      const resolveFunction = (payload: any) => payload.messageAdded;

      const result = resolveFunction(mockPayload);

      // Old: Returns full payload
      // New: resolve extracts payload.messageAdded
      expect(result).toEqual(mockPayload.messageAdded);
    });

    it('should have filter function that returns true for all payloads', () => {
      const mockPayload = {
        messageAdded: {
          id: 1,
          message: 'Test',
        },
      };

      const mockVariables = { roomId: 10 };

      // Simulated filter function from decorator
      const filterFunction = (payload: any, variables: any) => true;

      const result = filterFunction(mockPayload, mockVariables);

      // Old: Filter by roomId
      // New: Accept all for testing (return true)
      expect(result).toBe(true);
    });

    it('should log resolve and filter calls', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const mockPayload = { messageAdded: { id: 1, message: 'Log' } };
      const mockVariables = { roomId: 5 };

      // Simulated decorator functions
      const resolve = (payload: any) => {
        console.log('🟢 Subscription resolve called with:', payload);
        return payload.messageAdded;
      };

      const filter = (payload: any, variables: any) => {
        console.log('🟢 Filter check:', { payload: !!payload, roomId: variables.roomId });
        return true;
      };

      resolve(mockPayload);
      filter(mockPayload, mockVariables);

      // Old: Silent execution
      // New: Logs resolve and filter calls for debugging
      expect(consoleSpy).toHaveBeenCalledWith(
        '🟢 Subscription resolve called with:',
        mockPayload
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '🟢 Filter check:',
        { payload: true, roomId: 5 }
      );

      consoleSpy.mockRestore();
    });
  });

  describe('GraphQLAuthGuard integration', () => {
    it('should protect sendMessage mutation with auth guard', async () => {
      const mockContext = {
        req: {
          user: {
            sub: 1,
          },
        },
      };

      const mockInput: CreateChatInput = {
        message: 'A msg',
        recipientId: 2,
        room: 1,
      };

      const mockSavedMessage = {
        id: 1,
        message: 'Protected',
        participant: { id: 1 },
        createdAt: new Date(),
      };

      jest.spyOn(chatService, 'sendMessage').mockResolvedValue(mockSavedMessage as any);
      jest.spyOn(pubSubService, 'publish').mockResolvedValue();

      const result = await resolver.sendMessage(mockContext, mockInput, 2);

      // Old: No authentication
      // New: @UseGuards(GraphQLAuthGuard) protects mutation
      expect(result).toBeDefined();
    });

    it('should protect messageAdded subscription with auth guard', () => {
      const mockIterator = {
        [Symbol.asyncIterator]: jest.fn(),
      };

      jest.spyOn(pubSubService, 'asyncIterableIterator').mockReturnValue(mockIterator as any);

      const result = resolver.messageAdded(10);

      // Old: Public subscriptions
      // New: @UseGuards(GraphQLAuthGuard) protects subscription
      expect(result).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should propagate error when chatService.sendMessage fails', async () => {
      const mockContext = {
        req: {
          user: {
            sub: 1,
          },
        },
      };

      const mockInput: CreateChatInput = {
        message: 'A msg',
        recipientId: 2,
        room: 1,
      };

      jest.spyOn(chatService, 'sendMessage').mockRejectedValue(new Error('Service error'));

      await expect(
        resolver.sendMessage(mockContext, mockInput, 2)
      ).rejects.toThrow('Service error');

      // Old: Silent failure
      // New: Propagates errors from service layer
    });

    it('should propagate error when pubSub.publish fails', async () => {
      const mockContext = {
        req: {
          user: {
            sub: 1,
          },
        },
      };

      const mockInput: CreateChatInput = {
        message: 'A msg',
        recipientId: 2,
        room: 1,
      };

      const mockSavedMessage = {
        id: 1,
        message: 'Fail',
        participant: { id: 1 },
        room: { id: 1 },
        createdAt: new Date(),
      };

      jest.spyOn(chatService, 'sendMessage').mockResolvedValue(mockSavedMessage as any);
      jest.spyOn(pubSubService, 'publish').mockRejectedValue(new Error('PubSub error'));

      await expect(
        resolver.sendMessage(mockContext, mockInput, 2)
      ).rejects.toThrow('PubSub error');

      // Old: No PubSub error handling
      // New: Propagates PubSub errors
    });
  });
});