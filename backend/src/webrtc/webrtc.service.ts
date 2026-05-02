import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../agents/entities/agent.entity';
import { EncryptionService } from '../common/encryption/encryption.service';
import { RedisService } from '../common/redis/redis.service';

export interface WebRtcCredentials {
  sip_uri: string;
  sip_password: string;
  wss_url: string;
  ice_servers: Array<RTCIceServerLike>;
  session_token: string;
  expires_in: number;
}

interface RTCIceServerLike {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * WebRtcService — provisioning para que el agente registre su softphone
 * web (SIP.js) contra Asterisk.
 *
 * Por seguridad, el password real del endpoint PJSIP del agente NUNCA se
 * envía al cliente; en su lugar generamos un **token efímero** (TTL 15 min)
 * que se usa como credencial SIP. Asterisk valida el token consultando
 * Redis vía un script de auth (o se persiste en `ps_auths` rotando cada
 * 15 min). En el MVP, devolvemos el secret real descifrado — pero queda
 * documentado el camino seguro.
 */
@Injectable()
export class WebRtcService {
  constructor(
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly redis: RedisService,
  ) {}

  async credentialsForUser(userId: number, companyId: number | null): Promise<WebRtcCredentials> {
    if (!companyId) throw new ForbiddenException('Usuario sin empresa');

    const agent = await this.agents.findOne({ where: { userId, companyId } });
    if (!agent) throw new NotFoundException('No tienes un agente asociado');
    if (!agent.isActive) throw new ForbiddenException('Agente desactivado');

    const sipPassword = this.encryption.decrypt(agent.sipSecretEncrypted);
    const sessionToken = this.encryption.generateRandomToken(24);
    await this.redis.set(`webrtc:session:${sessionToken}`, JSON.stringify({
      userId, companyId, agentId: Number(agent.id), extension: agent.extension,
    }), 60 * 15);

    // Settings de WebRTC por empresa (STUN/TURN)
    const wsRows = await this.ds.query(
      `SELECT stun_servers, turn_servers, sip_wss_url FROM webrtc_settings WHERE company_id = ?`,
      [companyId],
    );
    const ws = wsRows[0] ?? {};
    const ice: RTCIceServerLike[] = [];
    const stuns: string[] = ws.stun_servers ? (typeof ws.stun_servers === 'string' ? JSON.parse(ws.stun_servers) : ws.stun_servers) : ['stun:stun.l.google.com:19302'];
    for (const url of stuns) ice.push({ urls: url });

    if (ws.turn_servers) {
      const turns: any[] = typeof ws.turn_servers === 'string' ? JSON.parse(ws.turn_servers) : ws.turn_servers;
      for (const t of turns) {
        ice.push({
          urls: t.urls,
          username: t.username_encrypted ? this.encryption.decrypt(t.username_encrypted) : t.username,
          credential: t.credential_encrypted ? this.encryption.decrypt(t.credential_encrypted) : t.credential,
        });
      }
    }

    // IMPORTANTE: usamos `asterisk.publicHost` (no `asterisk.host`) porque
    // estos valores se envían al NAVEGADOR del agente. El navegador no puede
    // resolver hostnames internos de Docker como `host.docker.internal`; debe
    // ver el dominio público (ej: app.somoscallcenter.com).
    const publicHost = this.config.get<string>('asterisk.publicHost') ?? this.config.get<string>('asterisk.host');
    const wssDefault = `wss://${publicHost}:8089/ws`;
    return {
      sip_uri: `sip:${agent.extension}@${publicHost}`,
      sip_password: sipPassword,
      wss_url: ws.sip_wss_url ?? wssDefault,
      ice_servers: ice,
      session_token: sessionToken,
      expires_in: 60 * 15,
    };
  }
}
