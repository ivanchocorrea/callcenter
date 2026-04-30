import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from './entities/queue.entity';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { CallsModule } from '../calls/calls.module';

@Module({
  imports: [TypeOrmModule.forFeature([Queue]), CallsModule],
  providers: [QueuesService],
  controllers: [QueuesController],
  exports: [QueuesService],
})
export class QueuesModule {}
