import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as net from 'net';

export interface ComponentStatus {
  key: string;
  label: string;
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  message: string;
  /** Mensaje en lenguaje claro para no técnicos. */
  friendly: string;
  detail?: Record<string, unknown>;
}

export interface SystemStatus {
  generatedAt: string;
  overall: 'ok' | 'degraded' | 'down';
  version: string;
  lastUpdateAt: string | null;
  uptimeSeconds: number;
  components: ComponentStatus[];
  resources: {
    cpuLoadPercent: number;
    memoryUsedPercent: number;
    memoryUsedMb: number;
    memoryTotalMb: number;
    diskUsedPercent: number | null;
    diskUsedGb: number | null;
    diskTotalGb: number | null;
  };
}

/**
 * StatusService — Devuelve el estado del sistema en lenguaje sencillo.
 * Comprueba: backend (este proceso), base de datos, Asterisk (telefonía),
 * Redis (cache/colas), uso de recursos del servidor.
 */
@Injectable()
export class StatusService {
  private readonly log = new Logger(StatusService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getStatus(): Promise<SystemStatus> {
    const components: ComponentStatus[] = [];

    components.push(this.checkBackend());
    components.push(await this.checkDatabase());
    components.push(await this.checkAsterisk());
    components.push(await this.checkRedis());

    const overall: SystemStatus['overall'] =
      components.some(c => c.status === 'down')
        ? 'down'
        : components.some(c => c.status === 'degraded')
        ? 'degraded'
        : 'ok';

    const resources = await this.getResources();
    const version = await this.readVersion();
    const lastUpdateAt = await this.readLastUpdateAt();

    return {
      generatedAt: new Date().toISOString(),
      overall,
      version,
      lastUpdateAt,
      uptimeSeconds: Math.round(process.uptime()),
      components,
      resources,
    };
  }

  // ----------------------------------------------------------------------
  private checkBackend(): ComponentStatus {
    return {
      key: 'backend',
      label: 'Servidor del sistema',
      status: 'ok',
      message: `Activo. PID ${process.pid}, Node ${process.version}`,
      friendly: 'El sistema está activo y respondiendo.',
      detail: { pid: process.pid, node: process.version, env: process.env.NODE_ENV ?? 'development' },
    };
  }

  private async checkDatabase(): Promise<ComponentStatus> {
    try {
      const start = Date.now();
      await this.ds.query('SELECT 1');
      const ms = Date.now() - start;
      return {
        key: 'database',
        label: 'Base de datos (MySQL)',
        status: ms > 500 ? 'degraded' : 'ok',
        message: `Conectado en ${ms} ms`,
        friendly: ms > 500
          ? 'La base de datos responde lento. Conviene revisar la carga.'
          : 'La base de datos está conectada y responde correctamente.',
        detail: { responseMs: ms, host: process.env.MYSQL_HOST, database: process.env.MYSQL_DATABASE },
      };
    } catch (e: any) {
      return {
        key: 'database',
        label: 'Base de datos (MySQL)',
        status: 'down',
        message: `Error: ${e?.message ?? 'desconocido'}`,
        friendly: 'No se puede conectar con la base de datos. El sistema podría no guardar ni leer información.',
        detail: { host: process.env.MYSQL_HOST, database: process.env.MYSQL_DATABASE },
      };
    }
  }

  private async checkAsterisk(): Promise<ComponentStatus> {
    const host = process.env.ASTERISK_HOST ?? '127.0.0.1';
    const port = parseInt(process.env.ASTERISK_AMI_PORT ?? '5038', 10);
    const ok = await this.tcpProbe(host, port, 2000);
    return {
      key: 'telephony',
      label: 'Servidor de llamadas (Asterisk)',
      status: ok ? 'ok' : 'down',
      message: ok ? `Asterisk responde en ${host}:${port}` : `No responde en ${host}:${port}`,
      friendly: ok
        ? 'El servidor de llamadas está activo. Las llamadas pueden entrar y salir.'
        : 'El servidor de llamadas NO responde. Las llamadas pueden estar caídas.',
      detail: { host, port },
    };
  }

  private async checkRedis(): Promise<ComponentStatus> {
    const host = process.env.REDIS_HOST ?? '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);
    const ok = await this.tcpProbe(host, port, 1500);
    return {
      key: 'cache',
      label: 'Caché y colas (Redis)',
      status: ok ? 'ok' : 'degraded',
      message: ok ? `Redis responde en ${host}:${port}` : `No responde en ${host}:${port}`,
      friendly: ok
        ? 'El sistema de caché funciona correctamente.'
        : 'El sistema de caché no responde. Las funciones avanzadas pueden ir más lentas.',
      detail: { host, port },
    };
  }

  private tcpProbe(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise(resolve => {
      const socket = new net.Socket();
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
      socket.once('timeout', () => finish(false));
      socket.connect(port, host);
    });
  }

  private async getResources(): Promise<SystemStatus['resources']> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    // Carga aproximada (1 min) en porcentaje sobre número de núcleos
    const load1 = os.loadavg()[0] ?? 0;
    const cpuLoadPercent = Math.min(100, Math.round((load1 / Math.max(1, cpus.length)) * 100));

    let diskUsedGb: number | null = null;
    let diskTotalGb: number | null = null;
    let diskUsedPercent: number | null = null;
    try {
      const stats: any = await (fs as any).statfs?.(process.cwd());
      if (stats) {
        const total = Number(stats.blocks) * Number(stats.bsize);
        const free = Number(stats.bavail) * Number(stats.bsize);
        const used = total - free;
        diskTotalGb = +(total / 1024 ** 3).toFixed(2);
        diskUsedGb = +(used / 1024 ** 3).toFixed(2);
        diskUsedPercent = Math.round((used / total) * 100);
      }
    } catch {
      // statfs no disponible (Windows / Node antiguo) — se omite
    }

    return {
      cpuLoadPercent,
      memoryUsedPercent: Math.round((usedMem / totalMem) * 100),
      memoryUsedMb: Math.round(usedMem / 1024 ** 2),
      memoryTotalMb: Math.round(totalMem / 1024 ** 2),
      diskUsedPercent,
      diskUsedGb,
      diskTotalGb,
    };
  }

  private async readVersion(): Promise<string> {
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const raw = await fs.readFile(pkgPath, 'utf8');
      return JSON.parse(raw).version ?? '0.0.0';
    } catch {
      return process.env.APP_VERSION ?? '0.0.0';
    }
  }

  private async readLastUpdateAt(): Promise<string | null> {
    // Marcador escrito por el script de mantenimiento (update.sh)
    try {
      const stampPath = path.join(process.cwd(), '.maintenance', 'last-update.txt');
      const v = (await fs.readFile(stampPath, 'utf8')).trim();
      return v || null;
    } catch {
      return null;
    }
  }
}
