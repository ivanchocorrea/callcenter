import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageProvidersService } from './providers.service';
import { StorageProvidersController } from './providers.controller';

@Global()
@Module({
  providers: [StorageService, StorageProvidersService],
  controllers: [StorageProvidersController],
  exports: [StorageService, StorageProvidersService],
})
export class StorageModule {}
