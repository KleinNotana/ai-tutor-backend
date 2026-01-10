import { Controller, Post, Body, Get, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto, ChatResponseDto, SUPPORTED_LANGUAGES } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Get('health')
  healthCheck() {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'ai-tutor-backend',
    };
  }

  @Get('languages')
  getSupportedLanguages() {
    return {
      languages: SUPPORTED_LANGUAGES,
    };
  }

  @Post('send')
  async sendMessage(@Body() dto: SendMessageDto): Promise<ChatResponseDto> {
    this.logger.log(`Received message: ${dto.message.substring(0, 50)}... [Language: ${dto.targetLanguage || 'english'}]`);
    return this.chatService.sendMessage(dto.message, dto.chatHistory, dto.targetLanguage || 'english');
  }
}
