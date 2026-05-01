import { Module } from '@nestjs/common';
import { AsteriskBridgeService } from './asterisk-bridge.service';
import { AsteriskConfigService } from './asterisk-config.service';
import { AsteriskConfigController } from './asterisk-config.controller';

@Module({
  providers: [AsteriskBridgeService, AsteriskConfigService],
  controllers: [AsteriskConfigController],
  exports: [AsteriskBridgeService, AsteriskConfigService],
})
export class AsteriskModule {}
