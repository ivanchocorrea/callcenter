import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IvrMenu } from './entities/ivr-menu.entity';
import { IvrOption } from './entities/ivr-option.entity';
import { IvrAudioFile } from './entities/ivr-audio-file.entity';
import { IvrService } from './ivr.service';
import { IvrController } from './ivr.controller';
import { AsteriskModule } from '../asterisk/asterisk.module';

@Module({
  imports: [TypeOrmModule.forFeature([IvrMenu, IvrOption, IvrAudioFile]), AsteriskModule],
  providers: [IvrService],
  controllers: [IvrController],
  exports: [IvrService],
})
export class IvrModule {}
