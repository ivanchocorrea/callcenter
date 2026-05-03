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

  /** Path donde se escribe el archivo de troncales PJSIP. */
  private trunksConfPath(): string {
    return this.config.get<string>('asterisk.trunksConfPath') ?? '/etc/asterisk/trunks.conf';
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
        // Confiar en el CALLERID del canal saliente cuando Asterisk hace
        // Dial(PJSIP/<ext>) — sin esto, Asterisk pone el callerid del
        // endpoint en el From URI del INVITE al agente, y en entrantes
        // el navegador muestra el DID/callerid configurado en lugar del
        // numero real del que llama. Con trust_id_outbound=yes + un
        // Set(CALLERID(num)=...) en el dialplan, el From URI lleva el
        // caller real.
        'trust_id_outbound=yes',
        // Permitir que Asterisk envie/reciba updates de connected line
        // via re-INVITE (RFC 4916) — para reflejar caller cambiado en
        // medio de la llamada (transferencias, etc).
        'send_connected_line=yes',
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
      // mode 0644: el backend (root en el contenedor) escribe el archivo,
      // pero Asterisk corre como UID 1000 (otro usuario) y necesita leerlo.
      // El archivo vive en /etc/asterisk dentro de un volumen privado del
      // host (/opt/callcenter/asterisk/etc), así que world-readable es OK.
      fs.writeFileSync(filePath, lines.join('\n'), { mode: 0o644 });
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

  /**
   * Genera el archivo de troncales PJSIP desde la BD y hace `pjsip reload`.
   * Filtros: solo troncales de empresas con status='active'.
   *
   * Por cada troncal escribe 4-5 secciones PJSIP en /etc/asterisk/trunks.conf:
   *   - [trunk_<id>]         type=endpoint
   *   - [trunk_<id>-auth]    type=auth (con username/password en claro)
   *   - [trunk_<id>-aor]     type=aor con qualify
   *   - [trunk_<id>-reg]     type=registration (solo si direction != 'inbound')
   *   - [trunk_<id>-id]      type=identify (matchea IP del proveedor → endpoint)
   *
   * Después escribe el archivo y hace pjsip reload via AMI.
   */
  async syncAllTrunks(): Promise<{ written: number; reloaded: boolean; path: string; warnings: string[] }> {
    const warnings: string[] = [];
    const trunks: any[] = await this.ds.query(`
      SELECT t.id, t.company_id, t.name, t.host, t.proxy, t.port, t.username, t.auth_username,
             t.password_encrypted, t.domain, t.caller_id, t.transport, t.codecs,
             t.nat_enabled, t.ice_enabled, t.rewrite_contact, t.register_interval,
             t.encrypted_communication, t.srtp_mode, t.direction, t.priority,
             c.slug AS company_slug, c.display_name AS company_name
      FROM sip_trunks t
      INNER JOIN companies c ON c.id = t.company_id
      WHERE c.status = 'active'
      ORDER BY t.company_id, t.priority, t.id
    `);

    const lines: string[] = [
      '; ===================================================================',
      '; pjsip-trunks.conf — generado automáticamente por callcenter-backend',
      `; Total troncales: ${trunks.length}`,
      `; Generado: ${new Date().toISOString()}`,
      '; NO EDITAR A MANO — se sobrescribe en cada sync',
      '; ===================================================================',
      '',
    ];

    let companyHeaderId: number | null = null;
    for (const t of trunks) {
      if (t.company_id !== companyHeaderId) {
        lines.push('');
        lines.push(`; ── Empresa #${t.company_id} (${t.company_slug}) ──`);
        companyHeaderId = t.company_id;
      }

      let password: string;
      try {
        password = this.encryption.decrypt(t.password_encrypted);
      } catch (e: any) {
        warnings.push(`Troncal "${t.name}" (id=${t.id}): no se pudo desencriptar password (${e?.message})`);
        continue;
      }

      // Naming consistente con el resto del backend (outbound-dialer,
      // callbacks, campaigns, asterisk-realtime). Si cambia este formato,
      // hay que cambiarlo en TODOS esos lugares también.
      const trunkId = `trunk_${t.company_id}_${t.id}`;
      const transport = `transport-${t.transport}`;
      const codecsArr: string[] = Array.isArray(t.codecs) && t.codecs.length ? t.codecs : ['ulaw', 'alaw'];
      const codecs = codecsArr.join(',');
      const authUsername = t.auth_username || t.username;
      const direction: string = t.direction || 'both';
      const allowOutbound = direction === 'outbound' || direction === 'both';
      const allowInbound = direction === 'inbound' || direction === 'both';

      // ---------- endpoint ----------
      lines.push(
        `; Troncal "${t.name}" (${direction})`,
        `[${trunkId}]`,
        'type=endpoint',
        `transport=${transport}`,
        // Context genérico `from-trunk` (definido en extensions.conf). El
        // routing por DID se hace ahí, no por troncal — más simple de
        // mantener cuando se agregan/quitan troncales.
        'context=from-trunk',
        'disallow=all',
        `allow=${codecs}`,
        `aors=${trunkId}-aor`,
        `outbound_auth=${trunkId}-auth`,
        'direct_media=no',
        `from_user=${t.username}`,
        `from_domain=${t.domain || t.host}`,
      );
      if (t.caller_id) lines.push(`callerid=${t.caller_id}`);
      if (t.nat_enabled) {
        lines.push('rtp_symmetric=yes', 'force_rport=yes');
        if (t.rewrite_contact) lines.push('rewrite_contact=yes');
      }
      if (t.encrypted_communication && t.srtp_mode && t.srtp_mode !== 'disabled') {
        lines.push(`media_encryption=${t.srtp_mode === 'required' ? 'sdes' : 'no'}`);
      }
      lines.push('');

      // ---------- auth ----------
      lines.push(
        `[${trunkId}-auth]`,
        'type=auth',
        'auth_type=userpass',
        `username=${authUsername}`,
        `password=${password}`,
        '',
      );

      // ---------- aor ----------
      lines.push(
        `[${trunkId}-aor]`,
        'type=aor',
        `contact=sip:${t.host}:${t.port}`,
        // qualify_frequency=0 deshabilita el ping OPTIONS al proveedor.
        // Algunos proveedores (ej: Colombia RED) no responden a OPTIONS,
        // y si se hace qualify, marcan el AOR como Unreachable y Asterisk
        // rechaza llamadas con "0 available contacts". Sin qualify, el
        // AOR está siempre disponible y las llamadas salen normalmente.
        'qualify_frequency=0',
        '',
      );

      // ---------- registration ----------
      // Generamos REGISTER SIEMPRE que la troncal tenga credenciales — sin
      // importar la dirección. Razón: muchos providers (ej Colombia RED)
      // requieren que el cliente se registre INCLUSO para troncales solo
      // entrantes, porque enrutan los INVITE a la IP/puerto desde donde se
      // registró el cliente. Sin REGISTER, el provider no sabe a dónde
      // enviarte las llamadas → entrantes nunca llegan.
      // Si el provider usa peer-to-peer (sin auth, solo identify-by-IP),
      // configurar la troncal sin username/password y esto se omite.
      if (t.username && password) {
        lines.push(
          `[${trunkId}-reg]`,
          'type=registration',
          `transport=${transport}`,
          `outbound_auth=${trunkId}-auth`,
          `server_uri=sip:${t.host}:${t.port}`,
          `client_uri=sip:${t.username}@${t.domain || t.host}`,
          `contact_user=${t.username}`,
          `expiration=${t.register_interval || 300}`,
          'retry_interval=60',
          'forbidden_retry_interval=600',
          '',
        );
      }

      // ---------- identify (matchea IP del proveedor para llamadas entrantes) ----------
      if (allowInbound) {
        lines.push(
          `[${trunkId}-id]`,
          'type=identify',
          `endpoint=${trunkId}`,
          `match=${t.host}`,
          '',
        );
      }
    }

    const filePath = this.trunksConfPath();
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, lines.join('\n'), { mode: 0o644 });
      this.logger.log(`PJSIP trunks config escrito en ${filePath} (${trunks.length} troncales)`);
    } catch (e: any) {
      this.logger.error(`No se pudo escribir ${filePath}: ${e?.message}`);
      throw new Error(`No se pudo escribir el archivo PJSIP trunks: ${e?.message}`);
    }

    let reloaded = false;
    try {
      reloaded = await this.bridge.pjsipReload();
      if (!reloaded) warnings.push('pjsip reload falló o AMI no conectado. Recarga manual: docker exec cc-asterisk asterisk -rx "module reload res_pjsip.so"');
    } catch (e: any) {
      warnings.push(`pjsip reload error: ${e?.message}`);
    }

    return { written: trunks.length, reloaded, path: filePath, warnings };
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
