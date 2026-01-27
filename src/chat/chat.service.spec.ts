import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let chatService: ChatService;
  let chatService: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(chatService).toBeDefined();
  });
});
