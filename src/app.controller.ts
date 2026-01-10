import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getInfo() {
    return {
      name: 'AI English Tutor Backend',
      version: '1.0.0',
      environment: this.configService.get<string>('nodeEnv'),
      status: 'running',
    };
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
