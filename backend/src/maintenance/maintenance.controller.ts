import {
  BadRequestException, Body, Controller, ForbiddenException, Get,
  HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { StatusService } from './services/status.service';
import { ErrorsService } from './services/errors.service';
import { DependenciesService } from './services/dependencies.service';
import { BackupService } from './services/backup.service';
import { RestartService } from './services/restart.service';
import { MaintenanceAuditService } from './services/maintenance-audit.service';
import {
  AcknowledgeErrorDto, ApplyUpdatesDto, CreateBackupDto,
  ListErrorsQueryDto, RestartDto, RestoreBackupDto,
} from './dto/maintenance.dto';

/**
 * Panel de Mantenimiento — solo super_admin / company_admin pueden acceder.
 * Todas las acciones críticas exigen confirmación y quedan auditadas.
 */
@ApiTags('maintenance')
@ApiBearerAuth()
@Controller('maintenance')
@Roles('super_admin', 'company_admin')
export class MaintenanceController {
  constructor(
    private readonly status: StatusService,
    private readonly errors: ErrorsService,
    private readonly deps: DependenciesService,
    private readonly backups: BackupService,
    private readonly restart: RestartService,
    private readonly audit: MaintenanceAuditService,
  ) {}

  // -------------------------------------------------------- ESTADO
  @Get('status')
  async getStatus(@CurrentUser() u: AuthenticatedUser) {
    const s = await this.status.getStatus();
    await this.audit.log({
      userId: u.userId, actorEmail: u.email,
      action: 'view_status', success: true,
    });
    return s;
  }

  @Get('summary')
  async summary(@CurrentUser() u: AuthenticatedUser) {
    const [s, e] = await Promise.all([this.status.getStatus(), this.errors.summary()]);
    return { status: s, errors: e };
  }

  // -------------------------------------------------------- ERRORES
  @Get('errors')
  async listErrors(@Query() q: ListErrorsQueryDto, @CurrentUser() u: AuthenticatedUser) {
    const rows = await this.errors.list({
      severity: q.severity, status: q.status, source: q.source,
      limit: q.limit ?? 50, offset: q.offset ?? 0,
    });
    await this.audit.log({
      userId: u.userId, actorEmail: u.email,
      action: 'check_errors', success: true,
      metadata: { filters: q },
    });
    return rows;
  }

  @Post('errors/update')
  @HttpCode(HttpStatus.OK)
  async ackError(@Body() body: AcknowledgeErrorDto, @CurrentUser() u: AuthenticatedUser) {
    await this.errors.updateStatus(body.errorId, body.newStatus, u.userId);
    return { ok: true };
  }

  @Get('logs/download')
  async downloadLogs(
    @Query('format') format: 'txt' | 'json' = 'txt',
    @Res() res: Response,
    @CurrentUser() u?: AuthenticatedUser,
  ) {
    if (format !== 'txt' && format !== 'json') throw new BadRequestException('format debe ser txt o json');
    const content = await this.errors.exportLogs(format, 1000);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `system-logs-${stamp}.${format}`;
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (u) await this.audit.log({
      userId: u.userId, actorEmail: u.email,
      action: 'download_logs', target: format, success: true,
    });
    res.send(content);
  }

  // -------------------------------------------------------- DEPENDENCIAS
  @Get('updates/check')
  async checkUpdates(@CurrentUser() u: AuthenticatedUser) {
    const t0 = Date.now();
    const r = await this.deps.checkOutdated(u.userId);
    await this.audit.log({
      userId: u.userId, actorEmail: u.email,
      action: 'check_updates', success: true, durationMs: Date.now() - t0,
      metadata: { summary: r.summary },
    });
    return r;
  }

  @Post('updates/apply-safe')
  @HttpCode(HttpStatus.OK)
  async applySafe(@Body() body: ApplyUpdatesDto, @CurrentUser() u: AuthenticatedUser) {
    if (!body.confirm) throw new BadRequestException('Debe confirmar la actualización');
    if (!body.onlySafe) {
      throw new BadRequestException(
        'Solo se permiten actualizaciones seguras (patch/minor) desde el panel. ' +
        'Una versión MAYOR debe revisarla un desarrollador.',
      );
    }
    // Respaldo antes de actualizar
    await this.backups.create({
      triggeredBy: u.userId, triggerType: 'pre_update',
      notes: `Respaldo automático previo a actualización de ${body.project}`,
    });
    const t0 = Date.now();
    const result = await this.deps.applySafeUpdates(body.project, u.userId);
    const success = result.every(r => r.success);
    await this.audit.log({
      userId: u.userId, actorEmail: u.email,
      action: 'apply_safe_updates', target: body.project, success,
      durationMs: Date.now() - t0,
      metadata: { result: result.map(r => ({ project: r.project, success: r.success })) },
    });
    return {
      success,
      result,
      message: success
        ? 'Actualización completada. Se recomienda reiniciar el servicio.'
        : 'La actualización falló en algún paquete. Revise el detalle.',
    };
  }

  // -------------------------------------------------------- RESPALDOS
  @Get('backups')
  async listBackups(@CurrentUser() u: AuthenticatedUser) {
    return this.backups.list(50);
  }

  @Post('backups/create')
  @HttpCode(HttpStatus.OK)
  async createBackup(@Body() body: CreateBackupDto, @CurrentUser() u: AuthenticatedUser) {
    const t0 = Date.now();
    try {
      const r = await this.backups.create({
        triggeredBy: u.userId, triggerType: 'manual',
        includeDb: body.includeDb, includeUploads: body.includeUploads,
        includeConfig: body.includeConfig, notes: body.notes,
      });
      await this.audit.log({
        userId: u.userId, actorEmail: u.email,
        action: 'create_backup', success: true, durationMs: Date.now() - t0,
        metadata: { id: r.id, sizeBytes: r.sizeBytes },
      });
      return { ok: true, ...r, message: 'Respaldo creado correctamente.' };
    } catch (e: any) {
      await this.audit.log({
        userId: u.userId, actorEmail: u.email,
        action: 'create_backup', success: false, durationMs: Date.now() - t0,
        notes: String(e?.message ?? e).slice(0, 500),
      });
      throw e;
    }
  }

  @Post('backups/restore')
  @HttpCode(HttpStatus.OK)
  async restoreBackup(@Body() body: RestoreBackupDto, @CurrentUser() u: AuthenticatedUser) {
    if (!body.confirm1 || !body.confirm2) {
      throw new BadRequestException('Debe marcar las DOS confirmaciones para restaurar.');
    }
    if ((body.confirmationPhrase ?? '').trim().toUpperCase() !== 'RESTAURAR') {
      throw new BadRequestException('Debe escribir exactamente la palabra "RESTAURAR" para confirmar.');
    }
    const t0 = Date.now();
    try {
      const r = await this.backups.restore(body.backupId, u.userId);
      await this.audit.log({
        userId: u.userId, actorEmail: u.email,
        action: 'restore_backup', target: String(body.backupId), success: true,
        durationMs: Date.now() - t0,
      });
      return { ok: true, ...r, message: 'Restauración completada. Se recomienda reiniciar el servicio.' };
    } catch (e: any) {
      await this.audit.log({
        userId: u.userId, actorEmail: u.email,
        action: 'restore_backup', target: String(body.backupId), success: false,
        durationMs: Date.now() - t0,
        notes: String(e?.message ?? e).slice(0, 500),
      });
      throw e;
    }
  }

  // -------------------------------------------------------- REINICIO
  @Post('restart')
  @HttpCode(HttpStatus.OK)
  async doRestart(@Body() body: RestartDto, @CurrentUser() u: AuthenticatedUser) {
    if (!body.confirm) throw new BadRequestException('Debe confirmar el reinicio.');
    if (body.target === 'all' && !u.roles.includes('super_admin')) {
      throw new ForbiddenException('Solo el super administrador puede reiniciar TODO.');
    }
    const r = await this.restart.schedule(body.target, u.userId, body.reason);
    await this.audit.log({
      userId: u.userId, actorEmail: u.email,
      action: 'restart_service', target: body.target, success: true,
      notes: body.reason ?? null,
    });
    return {
      ok: true, id: r.id,
      message: `Reinicio de "${body.target}" en curso. El sistema volverá a estar activo en unos segundos.`,
    };
  }

  @Get('restart/history')
  async restartHistory() {
    return this.restart.list(30);
  }

  @Get('restart/last')
  async lastRestart() {
    return this.restart.lastStatus();
  }

  // -------------------------------------------------------- AUDITORÍA
  @Get('audit')
  async auditList(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return this.audit.list(limit ?? 50, offset ?? 0);
  }
}
