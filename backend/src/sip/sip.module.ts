import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SipTrunk } from './entities/sip-trunk.entity';
import { SipTrunksService } from './sip-trunks.service';
import { SipTrunksController } from './sip-trunks.controller';
import { AsteriskRealtimeService } from './asterisk-realtime.service';

@Module({
  imports: [TypeOrmModule.forFeature([SipTrunk])],
  providers: [SipTrunksService, AsteriskRealtimeService],
  controllers: [SipTrunksController],
  exports: [SipTrunksService, AsteriskRealtimeService],
})
export class SipModule {}
