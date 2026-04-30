import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { AsteriskModule } from '../asterisk/asterisk.module';
import { InboundDispatcherService } from './inbound-dispatcher.service';

@Module({
  imports: [CallsModule, AsteriskModule],
  providers: [InboundDispatcherService],
  exports: [InboundDispatcherService],
})
export class InboundCallsModule {}
