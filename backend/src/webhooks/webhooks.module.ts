import { Global, Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhooksController } from './webhooks.controller';

@Global()
@Module({
  providers: [WebhooksService, WebhookDispatcherService],
  controllers: [WebhooksController],
  exports: [WebhooksService, WebhookDispatcherService],
})
export class WebhooksModule {}
