import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../decorators/public.decorator';

@Controller()
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Public()
  @Get('health/live')
  live() {
    return { status: 'ok', uptime_seconds: Math.round(process.uptime()) };
  }

  @Public()
  @Get('health/ready')
  async ready() {
    let db = false;
    try {
      await this.ds.query('SELECT 1');
      db = true;
    } catch {
      db = false;
    }
    return {
      status: db ? 'ok' : 'degraded',
      db,
      timestamp: new Date().toISOString(),
    };
  }
}
