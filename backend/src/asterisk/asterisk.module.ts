import { Module } from '@nestjs/common';
import { AsteriskBridgeService } from './asterisk-bridge.service';
import { AsteriskConfigService } from './asterisk-config.service';
import { AsteriskConfigController } from './asterisk-config.controller';
import { DialplanGeneratorService } from './dialplan-generator.service';

@Module({
  providers: [AsteriskBridgeService, AsteriskConfigService, DialplanGeneratorService],
  controllers: [AsteriskConfigController],
  exports: [AsteriskBridgeService, AsteriskConfigService, DialplanGeneratorService],
})
export class AsteriskModule {}
