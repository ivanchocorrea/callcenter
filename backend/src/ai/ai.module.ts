import { Module } from '@nestjs/common';
import { AIProviderService } from './providers/ai-provider.service';
import { ProvidersService } from './providers/providers.service';
import { ProvidersController } from './providers/providers.controller';
import { BotsService } from './bots/bots.service';
import { BotsController } from './bots/bots.controller';
import { PromptsService } from './prompts/prompts.service';
import { PromptsController } from './prompts/prompts.controller';
import { AIToolsService } from './tools/tools.service';
import { AIToolsController } from './tools/tools.controller';

@Module({
  providers: [AIProviderService, ProvidersService, BotsService, PromptsService, AIToolsService],
  controllers: [ProvidersController, BotsController, PromptsController, AIToolsController],
  exports: [AIProviderService, ProvidersService, BotsService, PromptsService, AIToolsService],
})
export class AIModule {}
