import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execP = promisify(exec);

export interface OutdatedItem {
  package: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'patch' | 'minor' | 'major' | 'none';
  isSafe: boolean;
  project: 'backend' | 'frontend';
}

export interface OutdatedReport {
  checkedAt: string;
  backend: OutdatedItem[];
  frontend: OutdatedItem[];
  summary: { patches: number; minor: number; major: number; total: number };
}

/**
 * DependenciesService — Encapsula `npm outdated` y `npm update`.
 * Reglas de seguridad:
 *   - patch  -> seguro
 *   - minor  -> seguro
 *   - major  -> NO se aplica automático: requiere intervención manual.
 */
@Injectable()
export class DependenciesService {
  private readonly log = new Logger(DependenciesService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // -------------------------------------------------------- check
  async checkOutdated(triggeredBy?: number | null): Promise<OutdatedReport> {
    const projectsRoot = this.projectsRoot();
    const backend = await this.npmOutdated(path.join(projectsRoot, 'backend'), 'backend');
    const frontend = await this.npmOutdated(path.join(projectsRoot, 'frontend'), 'frontend');
    const all = [...backend, ...frontend];

    // Persistir snapshot
    for (const it of all) {
      await this.ds.query(
        `INSERT INTO dependency_updates
         (triggered_by, project, package_name, current_version, wanted_version,
          latest_version, update_type, is_safe, action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'detected')`,
        [
          triggeredBy ?? null, it.project, it.package, it.current,
          it.wanted, it.latest, it.type, it.isSafe ? 1 : 0,
        ],
      );
    }

    return {
      checkedAt: new Date().toISOString(),
      backend, frontend,
      summary: {
        patches: all.filter(x => x.type === 'patch').length,
        minor:   all.filter(x => x.type === 'minor').length,
        major:   all.filter(x => x.type === 'major').length,
        total:   all.length,
      },
    };
  }

  // -------------------------------------------------------- apply
  /**
   * Aplica solo patches y minor de un proyecto. Mayor SIEMPRE se omite aquí:
   * el panel debe pedir al desarrollador que lo haga manualmente.
   */
  async applySafeUpdates(
    project: 'backend' | 'frontend' | 'all',
    triggeredBy?: number | null,
  ): Promise<{ project: string; output: string; success: boolean }[]> {
    const targets = project === 'all' ? ['backend', 'frontend'] : [project];
    const results: { project: string; output: string; success: boolean }[] = [];
    for (const t of targets) {
      const cwd = path.join(this.projectsRoot(), t);
      try {
        // npm update sin argumentos respeta el rango semver de package.json:
        // patch + minor en versiones tipo "^x.y.z", patch en "~x.y.z".
        const { stdout, stderr } = await execP('npm update --json', { cwd, timeout: 600_000, maxBuffer: 10 * 1024 * 1024 });
        results.push({ project: t, output: (stdout || stderr || '').slice(0, 8000), success: true });
        await this.ds.query(
          `INSERT INTO dependency_updates
           (triggered_by, project, package_name, current_version, update_type, is_safe, action)
           VALUES (?, ?, '__bulk_safe_update__', '*', 'patch', 1, 'applied')`,
          [triggeredBy ?? null, t],
        );
      } catch (e: any) {
        results.push({ project: t, output: (e?.stderr || e?.message || '').slice(0, 8000), success: false });
        await this.ds.query(
          `INSERT INTO dependency_updates
           (triggered_by, project, package_name, current_version, update_type, is_safe, action, error_message)
           VALUES (?, ?, '__bulk_safe_update__', '*', 'patch', 1, 'failed', ?)`,
          [triggeredBy ?? null, t, String(e?.message ?? '').slice(0, 1000)],
        );
      }
    }
    return results;
  }

  // -------------------------------------------------------- helpers
  private async npmOutdated(cwd: string, project: 'backend' | 'frontend'): Promise<OutdatedItem[]> {
    try {
      // npm outdated devuelve exit code 1 cuando hay paquetes desactualizados → capturamos stdout igual
      const r = await execP('npm outdated --json --long', { cwd, timeout: 120_000, maxBuffer: 5 * 1024 * 1024 })
        .catch(err => ({ stdout: err?.stdout ?? '', stderr: err?.stderr ?? '' }));
      const raw = (r as any).stdout?.trim() || '{}';
      const data = JSON.parse(raw);
      const items: OutdatedItem[] = [];
      for (const [pkg, info] of Object.entries<any>(data)) {
        const current = String(info.current ?? '');
        const wanted = String(info.wanted ?? '');
        const latest = String(info.latest ?? '');
        const type = this.diffType(current, latest);
        items.push({
          package: pkg, current, wanted, latest,
          type, isSafe: type !== 'major', project,
        });
      }
      return items;
    } catch (e) {
      this.log.warn(`npm outdated falló en ${cwd}: ${String(e)}`);
      return [];
    }
  }

  private diffType(a: string, b: string): OutdatedItem['type'] {
    const pa = a.replace(/^[^0-9]*/, '').split('.').map(n => parseInt(n, 10));
    const pb = b.replace(/^[^0-9]*/, '').split('.').map(n => parseInt(n, 10));
    if (!pa[0] || isNaN(pa[0]) || !pb[0] || isNaN(pb[0])) return 'none';
    if ((pb[0] ?? 0) > (pa[0] ?? 0)) return 'major';
    if ((pb[1] ?? 0) > (pa[1] ?? 0)) return 'minor';
    if ((pb[2] ?? 0) > (pa[2] ?? 0)) return 'patch';
    return 'none';
  }

  /** Raíz donde están las carpetas backend/ y frontend/. */
  private projectsRoot(): string {
    // process.cwd() = .../backend/  (o donde se haya iniciado nest)
    // si estamos dentro de backend/, subimos un nivel
    const cwd = process.cwd();
    return path.basename(cwd) === 'backend' ? path.resolve(cwd, '..') : cwd;
  }
}
