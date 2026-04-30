import { Module } from '@nestjs/common';
import { AsteriskModule } from '../asterisk/asterisk.module';
import { CallbacksService } from './callbacks.service';
import { CallbacksController } from './callbacks.controller';

@Module({
  imports: [AsteriskModule],
  providers: [CallbacksService],
  controllers: [CallbacksController],
  exports: [CallbacksService],
})
export class CallbacksModule {}
