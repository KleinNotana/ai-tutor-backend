import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageData {
  @IsOptional()
  @IsString()
  original?: string;

  @IsOptional()
  @IsString()
  correction?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  reply?: string;

  @IsOptional()
  @IsString()
  pronunciation?: string;
}

export class ChatMessage {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatMessageData)
  data?: ChatMessageData;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  message: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  chatHistory?: ChatMessage[];
}

export class ChatResponseData {
  original: string;
  correction: string;
  explanation: string;
  reply: string;
  pronunciation: string;
}

export class ChatResponseDto {
  success: boolean;
  data: ChatResponseData;
}
