import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallScript } from './entities/call-script.entity';
import { CallScriptsService } from './call-scripts.service';
import { CallScriptsController } from './call-scripts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CallScript])],
  providers: [CallScriptsService],
  controllers: [CallScriptsController],
  exports: [CallScriptsService],
})
export class CallScriptsModule {}
