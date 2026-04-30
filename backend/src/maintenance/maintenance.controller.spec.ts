import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { StatusService } from './services/status.service';
import { ErrorsService } from './services/errors.service';
import { DependenciesService } from './services/dependencies.service';
import { BackupService } from './services/backup.service';
import { RestartService } from './services/restart.service';
import { MaintenanceAuditService } from './services/maintenance-audit.service';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Pruebas unitarias del controlador. Validan los flujos de seguridad:
 *  - Las acciones críticas exigen confirmación.
 *  - Las versiones major NO se aplican.
 *  - El reinicio "all" solo lo permite super_admin.
 *  - La restauración exige doble confirmación + frase exacta.
 */
describe('MaintenanceController', () => {
  let ctrl: MaintenanceController;

  const status = { getStatus: jest.fn().mockResolvedValue({
    overall: 'ok', components: [], resources: {}, version: '1.0.0',
  }) };
  const errors = {
    list: jest.fn().mockResolvedValue([]),
    summary: jest.fn().mockResolvedValue({}),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    exportLogs: jest.fn().mockResolvedValue(''),
  };
  const deps = {
    checkOutdated: jest.fn().mockResolvedValue({
      backend: [], frontend: [], summary: { patches: 0, minor: 0, major: 0, total: 0 }, checkedAt: '',
    }),
    applySafeUpdates: jest.fn().mockResolvedValue([{ project: 'backend', success: true, output: '' }]),
  };
  const backups = {
    create: jest.fn().mockResolvedValue({ id: 1, filePath: 'x', sizeBytes: 1, sha256: 'abc' }),
    list: jest.fn().mockResolvedValue([]),
    restore: jest.fn().mockResolvedValue({ restored: true, fromId: 1 }),
  };
  const restart = {
    schedule: jest.fn().mockResolvedValue({ id: 1 }),
    list: jest.fn().mockResolvedValue([]),
    lastStatus: jest.fn().mockResolvedValue(null),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined), list: jest.fn().mockResolvedValue([]) };

  const adminUser: AuthenticatedUser = {
    userId: 1, email: 'admin@nodoe.test', companyId: 1,
    roles: ['company_admin'], permissions: [],
  };
  const superUser: AuthenticatedUser = {
    userId: 2, email: 'root@nodoe.test', companyId: null,
    roles: ['super_admin'], permissions: [],
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceController],
      providers: [
        { provide: StatusService, useValue: status },
        { provide: ErrorsService, useValue: errors },
        { provide: DependenciesService, useValue: deps },
        { provide: BackupService, useValue: backups },
        { provide: RestartService, useValue: restart },
        { provide: MaintenanceAuditService, useValue: audit },
      ],
    }).compile();
    ctrl = mod.get(MaintenanceController);
    jest.clearAllMocks();
  });

  it('getStatus auditea la consulta', async () => {
    await ctrl.getStatus(adminUser);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'view_status', success: true }));
  });

  it('applySafe rechaza si no se confirma', async () => {
    await expect(
      ctrl.applySafe({ project: 'backend', onlySafe: true, confirm: false }, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applySafe rechaza onlySafe=false (no permite mayor desde panel)', async () => {
    await expect(
      ctrl.applySafe({ project: 'backend', onlySafe: false, confirm: true }, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applySafe crea respaldo previo y aplica updates', async () => {
    const r = await ctrl.applySafe({ project: 'backend', onlySafe: true, confirm: true }, adminUser);
    expect(backups.create).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: 'pre_update', triggeredBy: 1 }),
    );
    expect(deps.applySafeUpdates).toHaveBeenCalledWith('backend', 1);
    expect(r.success).toBe(true);
  });

  it('restoreBackup exige doble confirmación', async () => {
    await expect(
      ctrl.restoreBackup({ backupId: 1, confirm1: false, confirm2: true, confirmationPhrase: 'RESTAURAR' }, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('restoreBackup exige frase exacta RESTAURAR', async () => {
    await expect(
      ctrl.restoreBackup({ backupId: 1, confirm1: true, confirm2: true, confirmationPhrase: 'restaurar ya' }, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('restoreBackup OK con doble confirmación + frase', async () => {
    const r = await ctrl.restoreBackup(
      { backupId: 1, confirm1: true, confirm2: true, confirmationPhrase: 'RESTAURAR' },
      adminUser,
    );
    expect(r.ok).toBe(true);
    expect(backups.restore).toHaveBeenCalledWith(1, 1);
  });

  it('restart "all" requiere super_admin', async () => {
    await expect(
      ctrl.doRestart({ target: 'all', confirm: true }, adminUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('restart "all" funciona para super_admin', async () => {
    const r = await ctrl.doRestart({ target: 'all', confirm: true }, superUser);
    expect(r.ok).toBe(true);
    expect(restart.schedule).toHaveBeenCalledWith('all', 2, undefined);
  });

  it('restart rechaza si no se confirma', async () => {
    await expect(
      ctrl.doRestart({ target: 'backend', confirm: false }, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
