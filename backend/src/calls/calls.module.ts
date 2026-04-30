import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Call } from './entities/call.entity';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { DispositionsController } from './dispositions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Call])],
  providers: [CallsService],
  controllers: [CallsController, DispositionsController],
  exports: [CallsService],
})
export class CallsModule {}
