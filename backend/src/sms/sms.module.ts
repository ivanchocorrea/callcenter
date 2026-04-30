import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { SmsProvidersService } from './providers.service';
import { SmsProvidersController } from './providers.controller';

@Module({
  providers: [SmsService, SmsProvidersService],
  controllers: [SmsController, SmsProvidersController],
  exports: [SmsService, SmsProvidersService],
})
export class SmsModule {}
