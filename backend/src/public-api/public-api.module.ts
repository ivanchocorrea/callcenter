import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { CustomersModule } from '../customers/customers.module';
import { SmsModule } from '../sms/sms.module';
import { OutboundDialerModule } from '../outbound-dialer/outbound-dialer.module';
import { PublicApiService } from './public-api.service';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysController, PublicApiV1Controller } from './public-api.controller';

@Module({
  imports: [CallsModule, CustomersModule, SmsModule, OutboundDialerModule],
  providers: [PublicApiService, ApiKeyGuard],
  controllers: [ApiKeysController, PublicApiV1Controller],
  exports: [PublicApiService],
})
export class PublicApiModule {}
