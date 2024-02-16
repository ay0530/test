import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/health-check')
  healthCheck(): string {
    return 'OK';
  }

  @Get('/')
  healthCheck2(): string {
    return 'OK';
  }
}
