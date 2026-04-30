import { Module } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { SmsModule } from '../sms/sms.module';
import { CallbacksModule } from '../callbacks/callbacks.module';

@Module({
  imports: [SmsModule, CallbacksModule],
  providers: [AutomationsService],
  controllers: [AutomationsController],
  exports: [AutomationsService],
})
export class AutomationsModule {}
