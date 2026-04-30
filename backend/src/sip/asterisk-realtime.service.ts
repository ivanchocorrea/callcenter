import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SipTrunk } from './entities/sip-trunk.entity';

/**
 * Escribe la configuración PJSIP a las tablas que Asterisk consume vía
 * res_pjsip_realtime (sorcery + ODBC). Esto permite que NUEVAS troncales
 * estén disponibles **sin reload** de Asterisk.
 *
 * Tablas estándar Asterisk Realtime:
 *   - ps_aors
 *   - ps_auths
 *   - ps_endpoints
 *   - ps_registrations  (cuando la troncal requiere registro saliente)
 *
 * Estas tablas son creadas por Asterisk con `realtime` (alembic) en su propio
 * esquema. En este módulo asumimos que viven en la misma DB `callcenter` (o
 * que hay un foreign data wrapper). Si las pones en otra DB, ajusta la conexión.
 *
 * Si en tu despliegue NO usas realtime, este servicio puede ser intercambiado
 * por uno que escriba archivos a `/etc/asterisk/pjsip.d/*.conf` y emita
 * `pjsip reload` por AMI.
 */
@Injectable()
export class AsteriskRealtimeService {
  private readonly logger = new Logger(AsteriskRealtimeService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** ID de la sección PJSIP para esta troncal: `trunk_<company>_<id>`. */
  private sectionId(t: SipTrunk): string {
    return `trunk_${t.companyId}_${t.id}`;
  }

  async upsertTrunk(t: SipTrunk, plainPassword: string): Promise<void> {
    const id = this.sectionId(t);
    try {
      await this.upsertAor(id, t);
      await this.upsertAuth(id, t, plainPassword);
      await this.upsertEndpoint(id, t);
      if (t.direction !== 'inbound') {
        await this.upsertRegistration(id, t);
      } else {
        await this.deleteRegistration(id);
      }
      this.logger.log(`PJSIP realtime: upserted trunk ${id}`);
    } catch (err: any) {
      this.logger.error(`PJSIP realtime upsert falló para ${id}: ${err?.message ?? err}`);
      // No lanzamos: la troncal queda guardada en BD aunque Asterisk no esté listo.
    }
  }

  async deleteTrunk(t: SipTrunk): Promise<void> {
    const id = this.sectionId(t);
    try {
      await this.ds.query(`DELETE FROM ps_endpoints WHERE id = ?`, [id]);
      await this.ds.query(`DELETE FROM ps_auths WHERE id = ?`, [id]);
      await this.ds.query(`DELETE FROM ps_aors WHERE id = ?`, [id]);
      await this.deleteRegistration(id);
    } catch (err: any) {
      this.logger.warn(`PJSIP realtime delete falló para ${id}: ${err?.message ?? err}`);
    }
  }

  // --------------------------------------------------------- internals

  private async upsertAor(id: string, t: SipTrunk): Promise<void> {
    const contact = `sip:${t.host}:${t.port}`;
    await this.ds.query(
      `INSERT INTO ps_aors (id, contact, qualify_frequency, max_contacts)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE contact=VALUES(contact), qualify_frequency=VALUES(qualify_frequency), max_contacts=VALUES(max_contacts)`,
      [id, contact, 30, 1],
    );
  }

  private async upsertAuth(id: string, t: SipTrunk, plainPassword: string): Promise<void> {
    await this.ds.query(
      `INSERT INTO ps_auths (id, auth_type, username, password)
       VALUES (?, 'userpass', ?, ?)
       ON DUPLICATE KEY UPDATE username=VALUES(username), password=VALUES(password)`,
      [id, t.authUsername ?? t.username, plainPassword],
    );
  }

  private async upsertEndpoint(id: string, t: SipTrunk): Promise<void> {
    const codecs = (t.codecs && t.codecs.length ? t.codecs : ['opus', 'ulaw', 'alaw']).join(',');
    const mediaEncryption = t.encryptedCommunication ? (t.srtpMode === 'required' ? 'sdes' : 'no') : 'no';
    const transport = `transport-${t.transport}`;
    await this.ds.query(
      `INSERT INTO ps_endpoints
        (id, transport, aors, auth, outbound_auth, context, disallow, allow,
         direct_media, force_rport, rewrite_contact, rtp_symmetric, ice_support, media_encryption,
         from_user, from_domain, callerid)
       VALUES (?, ?, ?, ?, ?, 'from-trunk', 'all', ?, 'no', 'yes', ?, 'yes', ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         transport=VALUES(transport),
         aors=VALUES(aors),
         auth=VALUES(auth),
         outbound_auth=VALUES(outbound_auth),
         allow=VALUES(allow),
         rewrite_contact=VALUES(rewrite_contact),
         ice_support=VALUES(ice_support),
         media_encryption=VALUES(media_encryption),
         from_user=VALUES(from_user),
         from_domain=VALUES(from_domain),
         callerid=VALUES(callerid)`,
      [
        id,
        transport,
        id, // aors
        id, // auth
        id, // outbound_auth
        codecs,
        t.rewriteContact ? 'yes' : 'no',
        t.iceEnabled ? 'yes' : 'no',
        mediaEncryption,
        t.username,
        t.domain ?? t.host,
        t.callerId ?? `<sip:${t.username}@${t.domain ?? t.host}>`,
      ],
    );
  }

  private async upsertRegistration(id: string, t: SipTrunk): Promise<void> {
    await this.ds.query(
      `INSERT INTO ps_registrations
        (id, transport, outbound_auth, server_uri, client_uri, retry_interval, expiration)
       VALUES (?, ?, ?, ?, ?, 60, ?)
       ON DUPLICATE KEY UPDATE
         transport=VALUES(transport),
         outbound_auth=VALUES(outbound_auth),
         server_uri=VALUES(server_uri),
         client_uri=VALUES(client_uri),
         expiration=VALUES(expiration)`,
      [
        id,
        `transport-${t.transport}`,
        id,
        `sip:${t.host}:${t.port}`,
        `sip:${t.username}@${t.domain ?? t.host}`,
        Math.max(60, t.registerInterval),
      ],
    );
  }

  private async deleteRegistration(id: string): Promise<void> {
    await this.ds.query(`DELETE FROM ps_registrations WHERE id = ?`, [id]);
  }
}
