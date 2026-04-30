import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../agents/entities/agent.entity';
import { CallsModule } from '../calls/calls.module';
import { AsteriskModule } from '../asterisk/asterisk.module';
import { OutboundDialerService } from './outbound-dialer.service';
import { OutboundDialerController } from './outbound-dialer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Agent]), CallsModule, AsteriskModule],
  providers: [OutboundDialerService],
  controllers: [OutboundDialerController],
  exports: [OutboundDialerService],
})
export class OutboundDialerModule {}
