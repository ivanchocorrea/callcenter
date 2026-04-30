import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../agents/entities/agent.entity';
import { WebRtcService } from './webrtc.service';
import { WebRtcController } from './webrtc.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Agent])],
  providers: [WebRtcService],
  controllers: [WebRtcController],
  exports: [WebRtcService],
})
export class WebRtcModule {}
