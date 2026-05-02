import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as net from 'net';
import * as dgram from 'dgram';
import { randomBytes } from 'crypto';

import { SipTrunk } from './entities/sip-trunk.entity';
import { CreateSipTrunkDto, UpdateSipTrunkDto } from './dto/sip-trunk.dto';
import { EncryptionService } from '../common/encryption/encryption.service';
import { AsteriskRealtimeService } from './asterisk-realtime.service';
import { AsteriskConfigService } from '../asterisk/asterisk-config.service';
import { AuditService } from '../audit/audit.service';

export interface SipConnectionTestResult {
  success: boolean;
  responseCode?: number;
  responseLine?: string;
  latencyMs?: number;
  error?: string;
}

/** Vista pública de un trunk: NUNCA expone la password. */
export interface SipTrunkPublic {
  id: number;
  company_id: number;
  name: string;
  host: string;
  proxy: string | null;
  port: number;
  username: string;
  auth_username: string | null;
  domain: string | null;
  caller_id: string | null;
  transport: string;
  codecs: string[] | null;
  nat_enabled: boolean;
  ice_enabled: boolean;
  rewrite_contact: boolean;
  register_interval: number;
  keep_alive_interval: number;
  encrypted_communication: boolean;
  srtp_mode: string;
  direction: string;
  priority: number;
  fallback_trunk_id: number | null;
  max_concurrent_calls: number | null;
  advanced_config: Record<string, unknown> | null;
  status: string;
  last_registered_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SipTrunksService {
  private readonly logger = new Logger(SipTrunksService.name);

  constructor(
    @InjectRepository(SipTrunk) private readonly repo: Repository<SipTrunk>,
    private readonly encryption: EncryptionService,
    private readonly realtime: AsteriskRealtimeService,
    private readonly asteriskConfig: AsteriskConfigService,
    private readonly audit: AuditService,
  ) {}

  /** Regenera trunks.conf con todas las troncales y hace pjsip reload. NO crashea
   *  si Asterisk está caído (queda como warning en log y next sync lo retoma). */
  private async syncTrunksFile(): Promise<void> {
    try {
      const r = await this.asteriskConfig.syncAllTrunks();
      if (r.warnings?.length) {
        for (const w of r.warnings) this.logger.warn(w);
      }
    } catch (err: any) {
      this.logger.warn(`syncAllTrunks falló: ${err?.message ?? err}`);
    }
  }

  // ---------------------------------------------------------------- CRUD

  async list(companyId: number): Promise<SipTrunkPublic[]> {
    const rows = await this.repo.find({ where: { companyId }, order: { priority: 'ASC', name: 'ASC' } });
    return rows.map(r => this.toPublic(r));
  }

  async findById(id: number, companyId: number): Promise<SipTrunkPublic> {
    const t = await this.repo.findOne({ where: { id, companyId } });
    if (!t) throw new NotFoundException(`Troncal SIP ${id} no encontrada`);
    return this.toPublic(t);
  }

  async create(companyId: number, dto: CreateSipTrunkDto, actor?: { userId?: number; email?: string }): Promise<SipTrunkPublic> {
    const exists = await this.repo.findOne({ where: { companyId, name: dto.name } });
    if (exists) throw new ConflictException(`Ya existe troncal con nombre "${dto.name}"`);

    const trunk = this.repo.create({
      companyId,
      name: dto.name,
      host: dto.host,
      proxy: dto.proxy ?? null,
      port: dto.port ?? 5060,
      username: dto.username,
      authUsername: dto.auth_username ?? null,
      passwordEncrypted: this.encryption.encrypt(dto.password),
      domain: dto.domain ?? null,
      callerId: dto.caller_id ?? null,
      transport: dto.transport ?? 'udp',
      codecs: dto.codecs ?? ['opus', 'ulaw', 'alaw'],
      natEnabled: dto.nat_enabled ?? true,
      iceEnabled: dto.ice_enabled ?? false,
      rewriteContact: dto.rewrite_contact ?? true,
      registerInterval: dto.register_interval ?? 300,
      keepAliveInterval: dto.keep_alive_interval ?? 15,
      encryptedCommunication: dto.encrypted_communication ?? false,
      srtpMode: dto.srtp_mode ?? 'disabled',
      direction: dto.direction ?? 'both',
      priority: dto.priority ?? 100,
      fallbackTrunkId: dto.fallback_trunk_id ?? null,
      maxConcurrentCalls: dto.max_concurrent_calls ?? null,
      advancedConfig: dto.advanced_config ?? null,
      status: 'inactive',
    });
    const saved = await this.repo.save(trunk);

    // Sync con Asterisk realtime (no crashea si Asterisk no está disponible)
    try {
      await this.realtime.upsertTrunk(saved, dto.password);
    } catch (err: any) {
      this.logger.warn(`No se pudo sincronizar trunk con Asterisk: ${err?.message ?? err}. Trunk guardado en BD, sincroniza después desde /admin/asterisk.`);
    }

    // Regenera trunks.conf y hace pjsip reload (esto es lo que Asterisk
    // realmente lee — el realtime de arriba es un fallback histórico).
    await this.syncTrunksFile();

    // Audit log (no crashea si falla)
    try {
      await this.audit.log({
        companyId,
        userId: actor?.userId ?? null,
        actorEmail: actor?.email ?? null,
        action: 'sip_trunk.created',
        resourceType: 'sip_trunk',
        resourceId: saved.id,
        metadata: { name: saved.name, host: saved.host },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log falló: ${err?.message ?? err}`);
    }

    return this.toPublic(saved);
  }

  async update(id: number, companyId: number, dto: UpdateSipTrunkDto, actor?: { userId?: number; email?: string }): Promise<SipTrunkPublic> {
    const t = await this.repo.findOne({ where: { id, companyId } });
    if (!t) throw new NotFoundException(`Troncal SIP ${id} no encontrada`);

    let plainPassword: string | null = null;
    if (dto.password) {
      plainPassword = dto.password;
      t.passwordEncrypted = this.encryption.encrypt(dto.password);
    }
    if (dto.name !== undefined) t.name = dto.name;
    if (dto.host !== undefined) t.host = dto.host;
    if (dto.proxy !== undefined) t.proxy = dto.proxy;
    if (dto.port !== undefined) t.port = dto.port;
    if (dto.username !== undefined) t.username = dto.username;
    if (dto.auth_username !== undefined) t.authUsername = dto.auth_username;
    if (dto.domain !== undefined) t.domain = dto.domain;
    if (dto.caller_id !== undefined) t.callerId = dto.caller_id;
    if (dto.transport !== undefined) t.transport = dto.transport;
    if (dto.codecs !== undefined) t.codecs = dto.codecs;
    if (dto.nat_enabled !== undefined) t.natEnabled = dto.nat_enabled;
    if (dto.ice_enabled !== undefined) t.iceEnabled = dto.ice_enabled;
    if (dto.rewrite_contact !== undefined) t.rewriteContact = dto.rewrite_contact;
    if (dto.register_interval !== undefined) t.registerInterval = dto.register_interval;
    if (dto.keep_alive_interval !== undefined) t.keepAliveInterval = dto.keep_alive_interval;
    if (dto.encrypted_communication !== undefined) t.encryptedCommunication = dto.encrypted_communication;
    if (dto.srtp_mode !== undefined) t.srtpMode = dto.srtp_mode;
    if (dto.direction !== undefined) t.direction = dto.direction;
    if (dto.priority !== undefined) t.priority = dto.priority;
    if (dto.fallback_trunk_id !== undefined) t.fallbackTrunkId = dto.fallback_trunk_id;
    if (dto.max_concurrent_calls !== undefined) t.maxConcurrentCalls = dto.max_concurrent_calls;
    if (dto.advanced_config !== undefined) t.advancedConfig = dto.advanced_config;

    const saved = await this.repo.save(t);

    // Reaplicar config a Asterisk (no crashea si Asterisk no está disponible)
    try {
      const passwordForAsterisk = plainPassword ?? this.encryption.decrypt(saved.passwordEncrypted);
      await this.realtime.upsertTrunk(saved, passwordForAsterisk);
    } catch (err: any) {
      this.logger.warn(`No se pudo sincronizar trunk con Asterisk: ${err?.message ?? err}`);
    }

    // Regenera trunks.conf y hace pjsip reload.
    await this.syncTrunksFile();

    try {
      await this.audit.log({
        companyId,
        userId: actor?.userId ?? null,
        actorEmail: actor?.email ?? null,
        action: 'sip_trunk.updated',
        resourceType: 'sip_trunk',
        resourceId: saved.id,
        metadata: { changes: Object.keys(dto) },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log falló: ${err?.message ?? err}`);
    }
    return this.toPublic(saved);
  }

  async remove(id: number, companyId: number, actor?: { userId?: number; email?: string }): Promise<void> {
    const t = await this.repo.findOne({ where: { id, companyId } });
    if (!t) throw new NotFoundException(`Troncal SIP ${id} no encontrada`);
    try { await this.realtime.deleteTrunk(t); } catch (err: any) { this.logger.warn(`Realtime delete falló: ${err?.message}`); }
    await this.repo.remove(t);

    // Regenera trunks.conf (sin esta troncal) y hace pjsip reload.
    await this.syncTrunksFile();

    try {
      await this.audit.log({
        companyId,
        userId: actor?.userId ?? null,
        actorEmail: actor?.email ?? null,
        action: 'sip_trunk.deleted',
        resourceType: 'sip_trunk',
        resourceId: id,
      });
    } catch (err: any) { this.logger.warn(`Audit log falló: ${err?.message}`); }
  }

  // ---------------------------------------------------------------- TEST

  /**
   * Prueba la conectividad/aliveness de una troncal SIP.
   *
   * Estrategia en dos pasos (algunos proveedores como Colombia RED no
   * responden a SIP OPTIONS sin autenticar y solo aceptan REGISTER):
   *
   *  1) Intenta SIP OPTIONS — barato, no requiere credenciales. Si el
   *     servidor responde (200/401/403/404/407) la troncal está viva.
   *  2) Si OPTIONS falla con timeout, intenta SIP REGISTER (sin auth,
   *     esperamos 401 o 200). Cualquier respuesta SIP confirma que el
   *     servidor está vivo y aceptaría auth real para el registro.
   *  3) Si ambos fallan, marcamos error.
   */
  async testConnection(id: number, companyId: number): Promise<SipConnectionTestResult> {
    const t = await this.repo.findOne({ where: { id, companyId } });
    if (!t) throw new NotFoundException(`Troncal SIP ${id} no encontrada`);

    const start = Date.now();
    const tryProbe = async (): Promise<{ code?: number; line?: string; method: string }> => {
      try {
        const optsResult =
          t.transport === 'udp'
            ? await this.sendOptionsUdp(t.host, t.port, t.username)
            : await this.sendOptionsTcp(t.host, t.port, t.username);
        return { ...optsResult, method: 'OPTIONS' };
      } catch (optsErr: any) {
        // Fallback: REGISTER (solo UDP, que es 99% de los proveedores).
        if (t.transport === 'udp') {
          try {
            const regResult = await this.sendRegisterProbeUdp(t.host, t.port, t.username);
            return { ...regResult, method: 'REGISTER' };
          } catch (regErr: any) {
            throw new Error(`OPTIONS: ${optsErr?.message ?? optsErr}; REGISTER: ${regErr?.message ?? regErr}`);
          }
        }
        throw optsErr;
      }
    };

    try {
      const result = await tryProbe();
      const latencyMs = Date.now() - start;
      const ok = !!result.code && [200, 401, 403, 404, 407].includes(result.code);

      t.status = ok ? 'active' : 'error';
      t.lastError = ok ? null : result.line ?? 'No response';
      if (ok) t.lastRegisteredAt = new Date();
      await this.repo.save(t);

      return {
        success: ok,
        responseCode: result.code,
        responseLine: result.line ? `[${result.method}] ${result.line}` : undefined,
        latencyMs,
      };
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      t.status = 'error';
      t.lastError = msg;
      await this.repo.save(t);
      return { success: false, error: msg, latencyMs: Date.now() - start };
    }
  }

  /**
   * Envía un REGISTER (sin auth) y devuelve la PRIMERA respuesta del
   * servidor. Esperamos típicamente 401 Unauthorized (el servidor está
   * vivo y exige auth) o 200 OK (raro sin auth, pero posible). Esto es
   * un "ping" más robusto que OPTIONS para proveedores que no responden
   * OPTIONS pero sí REGISTER (ej: Colombia RED).
   */
  private sendRegisterProbeUdp(host: string, port: number, username: string, timeoutMs = 4000): Promise<{ code?: number; line?: string }> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const branch = `z9hG4bK${randomBytes(8).toString('hex')}`;
      const tag = randomBytes(4).toString('hex');
      const callId = `${randomBytes(8).toString('hex')}@callcenter`;
      const msg = [
        `REGISTER sip:${host} SIP/2.0`,
        `Via: SIP/2.0/UDP 0.0.0.0:0;branch=${branch};rport`,
        `Max-Forwards: 70`,
        `From: <sip:${username}@${host}>;tag=${tag}`,
        `To: <sip:${username}@${host}>`,
        `Call-ID: ${callId}`,
        `CSeq: 1 REGISTER`,
        `Contact: <sip:${username}@0.0.0.0>`,
        `Expires: 60`,
        `User-Agent: CallCenter-NODOE/0.1`,
        `Content-Length: 0`,
        '',
        '',
      ].join('\r\n');

      const buf = Buffer.from(msg);
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        socket.close();
        reject(new Error('Timeout esperando respuesta SIP a REGISTER'));
      }, timeoutMs);

      socket.on('message', message => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        const text = message.toString('utf8');
        const firstLine = text.split('\r\n')[0] ?? '';
        const m = /^SIP\/2\.0 (\d{3})\s*(.*)$/.exec(firstLine);
        socket.close();
        resolve({ code: m ? parseInt(m[1], 10) : undefined, line: firstLine });
      });

      socket.bind(0, () => {
        socket.send(buf, 0, buf.length, port, host, err => {
          if (err) {
            clearTimeout(timer);
            socket.close();
            reject(err);
          }
        });
      });
    });
  }

  private sendOptionsUdp(host: string, port: number, username: string, timeoutMs = 4000): Promise<{ code?: number; line?: string }> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const branch = `z9hG4bK${randomBytes(8).toString('hex')}`;
      const tag = randomBytes(4).toString('hex');
      const callId = `${randomBytes(8).toString('hex')}@callcenter`;
      const localPort = 0;
      const msg = [
        `OPTIONS sip:${username}@${host} SIP/2.0`,
        `Via: SIP/2.0/UDP 0.0.0.0;branch=${branch};rport`,
        `Max-Forwards: 70`,
        `From: <sip:probe@callcenter>;tag=${tag}`,
        `To: <sip:${username}@${host}>`,
        `Call-ID: ${callId}`,
        `CSeq: 1 OPTIONS`,
        `User-Agent: CallCenter-NODOE/0.1`,
        `Content-Length: 0`,
        '',
        '',
      ].join('\r\n');

      const buf = Buffer.from(msg);
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        socket.close();
        reject(new Error('Timeout esperando respuesta SIP'));
      }, timeoutMs);

      socket.on('message', message => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        const text = message.toString('utf8');
        const firstLine = text.split('\r\n')[0] ?? '';
        const m = /^SIP\/2\.0 (\d{3})\s*(.*)$/.exec(firstLine);
        socket.close();
        resolve({ code: m ? parseInt(m[1], 10) : undefined, line: firstLine });
      });

      socket.bind(localPort, () => {
        socket.send(buf, 0, buf.length, port, host, err => {
          if (err) {
            clearTimeout(timer);
            socket.close();
            reject(err);
          }
        });
      });
    });
  }

  private sendOptionsTcp(host: string, port: number, username: string, timeoutMs = 4000): Promise<{ code?: number; line?: string }> {
    return new Promise((resolve, reject) => {
      const socket = net.connect({ host, port, timeout: timeoutMs });
      let buffer = '';
      let done = false;

      const finish = (val: { code?: number; line?: string } | null, err?: Error) => {
        if (done) return;
        done = true;
        socket.destroy();
        err ? reject(err) : resolve(val ?? {});
      };

      socket.on('connect', () => {
        const branch = `z9hG4bK${randomBytes(8).toString('hex')}`;
        const tag = randomBytes(4).toString('hex');
        const callId = `${randomBytes(8).toString('hex')}@callcenter`;
        const msg = [
          `OPTIONS sip:${username}@${host} SIP/2.0`,
          `Via: SIP/2.0/TCP 0.0.0.0;branch=${branch};rport`,
          `Max-Forwards: 70`,
          `From: <sip:probe@callcenter>;tag=${tag}`,
          `To: <sip:${username}@${host}>`,
          `Call-ID: ${callId}`,
          `CSeq: 1 OPTIONS`,
          `User-Agent: CallCenter-NODOE/0.1`,
          `Content-Length: 0`,
          '',
          '',
        ].join('\r\n');
        socket.write(msg);
      });
      socket.on('data', chunk => {
        buffer += chunk.toString('utf8');
        if (buffer.includes('\r\n')) {
          const firstLine = buffer.split('\r\n')[0];
          const m = /^SIP\/2\.0 (\d{3})\s*(.*)$/.exec(firstLine);
          finish({ code: m ? parseInt(m[1], 10) : undefined, line: firstLine });
        }
      });
      socket.on('timeout', () => finish(null, new Error('Timeout TCP esperando respuesta SIP')));
      socket.on('error', err => finish(null, err));
    });
  }

  // ---------------------------------------------------------------- helpers

  private toPublic(t: SipTrunk): SipTrunkPublic {
    return {
      id: Number(t.id),
      company_id: Number(t.companyId),
      name: t.name,
      host: t.host,
      proxy: t.proxy,
      port: t.port,
      username: t.username,
      auth_username: t.authUsername,
      domain: t.domain,
      caller_id: t.callerId,
      transport: t.transport,
      codecs: t.codecs,
      nat_enabled: t.natEnabled,
      ice_enabled: t.iceEnabled,
      rewrite_contact: t.rewriteContact,
      register_interval: t.registerInterval,
      keep_alive_interval: t.keepAliveInterval,
      encrypted_communication: t.encryptedCommunication,
      srtp_mode: t.srtpMode,
      direction: t.direction,
      priority: t.priority,
      fallback_trunk_id: t.fallbackTrunkId,
      max_concurrent_calls: t.maxConcurrentCalls,
      advanced_config: t.advancedConfig,
      status: t.status,
      last_registered_at: t.lastRegisteredAt,
      last_error: t.lastError,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    };
  }
}
