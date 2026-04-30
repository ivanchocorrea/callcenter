import { Module } from '@nestjs/common';
import { AIProviderService } from './providers/ai-provider.service';
import { BotsService } from './bots/bots.service';
import { BotsController } from './bots/bots.controller';
import { PromptsService } from './prompts/prompts.service';
import { PromptsController } from './prompts/prompts.controller';
import { AIToolsService } from './tools/tools.service';
import { AIToolsController } from './tools/tools.controller';

@Module({
  providers: [AIProviderService, BotsService, PromptsService, AIToolsService],
  controllers: [BotsController, PromptsController, AIToolsController],
  exports: [AIProviderService, BotsService, PromptsService, AIToolsService],
})
export class AIModule {}
