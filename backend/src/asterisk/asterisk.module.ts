import { Module } from '@nestjs/common';
import { AsteriskBridgeService } from './asterisk-bridge.service';

@Module({
  providers: [AsteriskBridgeService],
  exports: [AsteriskBridgeService],
})
export class AsteriskModule {}
