import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AsteriskBridgeService } from './asterisk-bridge.service';
import { EncryptionService } from '../common/encryption/encryption.service';

/**
 * AsteriskConfigService
 * --------------------------------------------------------------
 * Mantiene un archivo PJSIP "live" con los agentes activos del sistema.
 *
 * Genera /etc/asterisk/agents.conf (o el path en config) con un bloque
 * por agente:
 *   [<extension>]
 *   type=endpoint
 *   transport=transport-wss
 *   webrtc=yes
 *   auth=<extension>-auth
 *   aors=<extension>
 *   context=from-internal
 *   ...
 *
 *   [<extension>-auth]
 *   type=auth
 *   auth_type=userpass
 *   username=<extension>
 *   password=<plain-secret>
 *
 *   [<extension>]
 *   type=aor
 *   max_contacts=5
 *   remove_existing=yes
 *
 * Después de escribir el archivo, ejecuta `pjsip reload` vía AMI.
 *
 * El archivo debe estar incluido en pjsip.conf con `#include "agents.conf"`.
 */
@Injectable()
export class AsteriskConfigService {
  private readonly logger = new Logger(AsteriskConfigService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly config: ConfigService,
    private readonly bridge: AsteriskBridgeService,
    private readonly encryption: EncryptionService,
  ) {}

  /** Path donde se escribe el archivo de agentes PJSIP. */
  private agentsConfPath(): string {
    return this.config.get<string>('asterisk.agentsConfPath') ?? '/etc/asterisk/agents.conf';
  }

  /**
   * Genera el archivo de agentes PJSIP desde la BD y hace `pjsip reload`.
   * Filtros: solo agentes is_active=true.
   * Si companyId se pasa, sincroniza solo esa empresa (NO recomendado: el archivo
   * es global, mejor regenerarlo entero).
   */
  async syncAllAgents(): Promise<{ written: number; reloaded: boolean; path: string; warnings: string[] }> {
    const warnings: string[] = [];
    const agents: any[] = await this.ds.query(`
      SELECT a.id, a.company_id, a.extension, a.sip_secret_encrypted, a.display_name, a.is_active,
             c.slug AS company_slug, c.display_name AS company_name
      FROM agents a
      INNER JOIN companies c ON c.id = a.company_id
      WHERE a.is_active = 1 AND c.status = 'active'
      ORDER BY a.company_id, a.extension
    `);

    const lines: string[] = [
      '; ===================================================================',
      '; pjsip-agents.conf — generado automáticamente por callcenter-backend',
      `; Total agentes activos: ${agents.length}`,
      `; Generado: ${new Date().toISOString()}`,
      '; NO EDITAR A MANO — se sobrescribe en cada sync',
      '; ===================================================================',
      '',
    ];

    let companyHeaderId: number | null = null;
    for (const a of agents) {
      if (a.company_id !== companyHeaderId) {
        lines.push('');
        lines.push(`; ── Empresa #${a.company_id} (${a.company_slug}) ──`);
        companyHeaderId = a.company_id;
      }
      let secret: string;
      try {
        secret = this.encryption.decrypt(a.sip_secret_encrypted);
      } catch (e: any) {
        warnings.push(`Agente ${a.extension}: no se pudo desencriptar secret (${e?.message})`);
        continue;
      }
      const ext = a.extension;
      lines.push(
        `[${ext}]`,
        'type=endpoint',
        'transport=transport-wss',
        'webrtc=yes',
        'use_avpf=yes',
        'media_encryption=dtls',
        'dtls_verify=fingerprint',
        'dtls_setup=actpass',
        'ice_support=yes',
        'media_use_received_transport=yes',
        'rtcp_mux=yes',
        'allow=opus,ulaw,alaw',
        `auth=${ext}-auth`,
        `aors=${ext}`,
        'context=from-internal',
        `callerid="${a.display_name.replace(/"/g, '')}" <${ext}>`,
        '',
        `[${ext}-auth]`,
        'type=auth',
        'auth_type=userpass',
        `username=${ext}`,
        `password=${secret}`,
        '',
        `[${ext}]`,
        'type=aor',
        'max_contacts=5',
        'remove_existing=yes',
        'qualify_frequency=30',
        '',
      );
    }

    const filePath = this.agentsConfPath();
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, lines.join('\n'), { mode: 0o640 });
      this.logger.log(`PJSIP agents config escrito en ${filePath} (${agents.length} agentes)`);
    } catch (e: any) {
      this.logger.error(`No se pudo escribir ${filePath}: ${e?.message}`);
      throw new Error(`No se pudo escribir el archivo PJSIP: ${e?.message}`);
    }

    let reloaded = false;
    try {
      reloaded = await this.bridge.pjsipReload();
      if (!reloaded) warnings.push('pjsip reload falló o AMI no conectado. Recarga manual: docker exec asterisk asterisk -rx "pjsip reload"');
    } catch (e: any) {
      warnings.push(`pjsip reload error: ${e?.message}`);
    }

    return { written: agents.length, reloaded, path: filePath, warnings };
  }

  /** Estado actual del bridge Asterisk + endpoints registrados (vía AMI). */
  async status(): Promise<{
    ari_connected: boolean;
    ami_connected: boolean;
    endpoints_raw: string;
    endpoint_count: number;
    online_count: number;
    file_exists: boolean;
    file_path: string;
    file_size_bytes: number;
    file_modified: string | null;
  }> {
    const conn = this.bridge.isConnected();
    let endpointsRaw = 'AMI no conectado';
    let count = 0;
    let online = 0;
    if (conn.ami) {
      try {
        endpointsRaw = await this.bridge.pjsipShowEndpoints();
        // Cuenta líneas tipo "Endpoint: <name>"
        const lines = endpointsRaw.split('\n').filter(l => l.trim().toLowerCase().startsWith('endpoint:'));
        count = lines.length;
        online = lines.filter(l => /\b(In use|Not in use|Available)\b/i.test(l)).length;
      } catch (e: any) {
        endpointsRaw = `Error consultando AMI: ${e?.message}`;
      }
    }
    const filePath = this.agentsConfPath();
    let fileExists = false;
    let fileSize = 0;
    let fileMtime: Date | null = null;
    try {
      const st = fs.statSync(filePath);
      fileExists = true;
      fileSize = st.size;
      fileMtime = st.mtime;
    } catch { /* no existe */ }
    return {
      ari_connected: conn.ari,
      ami_connected: conn.ami,
      endpoints_raw: endpointsRaw,
      endpoint_count: count,
      online_count: online,
      file_exists: fileExists,
      file_path: filePath,
      file_size_bytes: fileSize,
      file_modified: fileMtime ? fileMtime.toISOString() : null,
    };
  }

  /** Ejecuta `pjsip reload` directamente. */
  async reloadPjsip(): Promise<boolean> {
    return this.bridge.pjsipReload();
  }
}
