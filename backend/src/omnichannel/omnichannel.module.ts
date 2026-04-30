import { Module } from '@nestjs/common';
import { OmnichannelService } from './omnichannel.service';
import { OmnichannelController } from './omnichannel.controller';

@Module({
  providers: [OmnichannelService],
  controllers: [OmnichannelController],
  exports: [OmnichannelService],
})
export class OmnichannelModule {}
