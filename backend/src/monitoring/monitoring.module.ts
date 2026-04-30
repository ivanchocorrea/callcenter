import { Module } from '@nestjs/common';
import { AsteriskModule } from '../asterisk/asterisk.module';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [AsteriskModule],
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MonitoringModule {}
