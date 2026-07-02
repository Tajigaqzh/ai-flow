import { Body, Controller, Post, Res } from '@nestjs/common';
import type { ChatRequestDto } from './chat.service';
import { ChatService } from './chat.service';

type StreamResponse = {
  end: () => void;
  flushHeaders: () => void;
  setHeader: (name: string, value: string) => void;
  write: (chunk: string) => void;
};

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('stream')
  async streamReply(
    @Body() request: ChatRequestDto,
    @Res() response: StreamResponse,
  ): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();

    try {
      for await (const delta of this.chatService.streamReply(request)) {
        response.write(`event: delta\n`);
        response.write(`data: ${JSON.stringify(delta)}\n\n`);
      }

      response.write(`event: done\n`);
      response.write(`data: {}\n\n`);
      response.end();
    } catch (error) {
      response.write(`event: error\n`);
      response.write(
        `data: ${JSON.stringify(
          error instanceof Error ? error.message : 'AI stream failed',
        )}\n\n`,
      );
      response.end();
    }
  }
}
