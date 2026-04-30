import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { StatusService } from './services/status.service';
import { ErrorsService } from './services/errors.service';
import { DependenciesService } from './services/dependencies.service';
import { BackupService } from './services/backup.service';
import { RestartService } from './services/restart.service';
import { MaintenanceAuditService } from './services/maintenance-audit.service';

@Module({
  controllers: [MaintenanceController],
  providers: [
    StatusService,
    ErrorsService,
    DependenciesService,
    BackupService,
    RestartService,
    MaintenanceAuditService,
  ],
  exports: [ErrorsService],
})
export class MaintenanceModule {}
