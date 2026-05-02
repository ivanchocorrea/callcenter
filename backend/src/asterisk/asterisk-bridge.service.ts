import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../events/event-bus.service';

/**
 * AsteriskBridgeService
 * --------------------------------------------------------------
 * Mantiene la conexión persistente al ARI WebSocket de Asterisk y a AMI
 * (este último como fallback para eventos legacy y comandos que no expone ARI
 * como `database show`). Re-conecta con backoff exponencial si la conexión cae.
 *
 * Eventos que despacha al EventBus interno (canal `asterisk:event`):
 *   { source:'ari', name:'StasisStart', payload:{...} }
 *   { source:'ari', name:'StasisEnd',   payload:{...} }
 *   { source:'ari', name:'ChannelStateChange', payload:{...} }
 *   { source:'ari', name:'ChannelDtmfReceived', payload:{...} }
 *   { source:'ami', name:'PeerStatus', payload:{...} }   (fallback)
 *
 * Comandos expuestos:
 *   continueInDialplan, playback, hold, bridge, snoop, hangup,
 *   originate, sendDtmf, setChannelVar.
 *
 * Las dependencias `ari-client` y `asterisk-manager` se cargan vía require
 * dinámico para que la falta del paquete (en dev sin Asterisk) no rompa el
 * arranque — solo loguea un warn.
 */
@Injectable()
export class AsteriskBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AsteriskBridgeService.name);
  private ariClient: any = null;
  private amiClient: any = null;
  private ariConnected = false;
  private amiConnected = false;
  private reconnectAttempts = 0;
  private destroyed = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly bus: EventBusService,
  ) {}

  async onModuleInit(): Promise<void> {
    void this.connectAri();
    void this.connectAmi();
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try { await this.ariClient?.stop?.(); } catch { /* ignore */ }
    try { this.amiClient?.disconnect?.(); } catch { /* ignore */ }
  }

  isConnected(): { ari: boolean; ami: boolean } {
    return { ari: this.ariConnected, ami: this.amiConnected };
  }

  // --------------------------------------------------- ARI

  private async connectAri(): Promise<void> {
    if (this.destroyed) return;
    let ari: any;
    try {
      // require dinámico para evitar romper el arranque si el paquete no está
      ari = require('ari-client');
    } catch {
      this.logger.warn('Paquete `ari-client` no instalado; ARI deshabilitado.');
      return;
    }
    const host = this.config.get<string>('asterisk.host');
    const port = this.config.get<number>('asterisk.ari.port');
    const user = this.config.get<string>('asterisk.ari.username');
    const pass = this.config.get<string>('asterisk.ari.password');
    const app = this.config.get<string>('asterisk.ari.appName');
    const url = `http://${host}:${port}`;

    try {
      const client = await ari.connect(url, user, pass);
      this.ariClient = client;
      this.ariConnected = true;
      this.reconnectAttempts = 0;
      this.logger.log(`ARI conectado a ${url} (app: ${app})`);

      // Eventos de interés
      const forward = (name: string) => (event: any, channel: any) => {
        this.bus.publish('asterisk:event', { source: 'ari', name, payload: { event, channel } }).catch(() => undefined);
      };
      [
        'StasisStart',
        'StasisEnd',
        'ChannelStateChange',
        'ChannelDtmfReceived',
        'ChannelVarset',
        'ChannelHangupRequest',
        'ChannelDestroyed',
        'PlaybackStarted',
        'PlaybackFinished',
        'BridgeCreated',
        'BridgeDestroyed',
        'ChannelEnteredBridge',
        'ChannelLeftBridge',
      ].forEach(evt => client.on(evt, forward(evt)));

      client.on('WebSocketReconnecting', () => this.logger.warn('ARI reconectando…'));
      client.on('APILoadError', (err: any) => this.logger.error(`ARI APILoadError: ${err?.message ?? err}`));
      client.on('error', (err: any) => this.logger.error(`ARI error: ${err?.message ?? err}`));
      client.on('close', () => {
        this.ariConnected = false;
        this.logger.warn('ARI cerrado');
        this.scheduleAriReconnect();
      });

      await client.start(app);
    } catch (err: any) {
      this.ariConnected = false;
      this.logger.error(`ARI connect falló: ${err?.message ?? err}`);
      this.scheduleAriReconnect();
    }
  }

  private scheduleAriReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.logger.log(`ARI reintento en ${delay} ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectAri();
    }, delay);
  }

  // --------------------------------------------------- AMI

  private connectAmi(): void {
    if (this.destroyed) return;
    let AsteriskManager: any;
    try {
      AsteriskManager = require('asterisk-manager');
    } catch {
      this.logger.warn('Paquete `asterisk-manager` no instalado; AMI deshabilitado.');
      return;
    }
    const host = this.config.get<string>('asterisk.host');
    const port = this.config.get<number>('asterisk.ami.port');
    const user = this.config.get<string>('asterisk.ami.username');
    const pass = this.config.get<string>('asterisk.ami.password');

    const ami = new AsteriskManager(port, host, user, pass, true);
    ami.keepConnected();
    this.amiClient = ami;
    ami.on('connect', () => {
      this.amiConnected = true;
      this.logger.log(`AMI conectado a ${host}:${port}`);
    });
    ami.on('disconnect', () => {
      this.amiConnected = false;
      this.logger.warn('AMI desconectado');
    });
    ami.on('error', (err: any) => this.logger.error(`AMI error: ${err?.message ?? err}`));
    ami.on('managerevent', (evt: any) => {
      this.bus.publish('asterisk:event', { source: 'ami', name: evt.event, payload: evt }).catch(() => undefined);
    });
  }

  // --------------------------------------------------- comandos ARI

  private requireAri(): any {
    if (!this.ariConnected || !this.ariClient) {
      throw new Error('ARI no está conectado');
    }
    return this.ariClient;
  }

  async continueInDialplan(channelId: string, context: string, exten: string, priority = 1): Promise<void> {
    const ari = this.requireAri();
    await ari.channels.continueInDialplan({ channelId, context, extension: exten, priority });
  }

  async playback(channelId: string, mediaUri: string): Promise<string> {
    const ari = this.requireAri();
    const playbackId = `pb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await ari.channels.play({ channelId, media: mediaUri, playbackId });
    return playbackId;
  }

  async hold(channelId: string, hold: boolean): Promise<void> {
    const ari = this.requireAri();
    if (hold) {
      await ari.channels.hold({ channelId });
      await ari.channels.startMoh({ channelId }).catch(() => undefined);
    } else {
      await ari.channels.stopMoh({ channelId }).catch(() => undefined);
      await ari.channels.unhold({ channelId });
    }
  }

  async bridge(channelIds: string[]): Promise<string> {
    const ari = this.requireAri();
    const bridge = await ari.bridges.create({ type: 'mixing' });
    await Promise.all(channelIds.map(id => ari.bridges.addChannel({ bridgeId: bridge.id, channel: id })));
    return bridge.id;
  }

  async hangup(channelId: string, reason?: string): Promise<void> {
    const ari = this.requireAri();
    await ari.channels.hangup({ channelId, reason }).catch(() => undefined);
  }

  /** Snooping para escucha/susurro/barge-in del supervisor. */
  async snoop(channelId: string, mode: 'spy' | 'whisper' | 'both', appName: string, supervisorChannelId?: string): Promise<string> {
    const ari = this.requireAri();
    const result = await ari.channels.snoopChannel({
      channelId,
      app: appName,
      spy: mode === 'spy' || mode === 'both' ? 'in' : 'none',
      whisper: mode === 'whisper' || mode === 'both' ? 'out' : 'none',
      snoopId: `snoop_${Date.now()}`,
    });
    return result?.id ?? result?.channel?.id ?? '';
  }

  async setChannelVar(channelId: string, variable: string, value: string): Promise<void> {
    const ari = this.requireAri();
    await ari.channels.setChannelVar({ channelId, variable, value });
  }

  async sendDtmf(channelId: string, dtmf: string): Promise<void> {
    const ari = this.requireAri();
    await ari.channels.sendDTMF({ channelId, dtmf });
  }

  /**
   * Transferencia ciega (blind transfer): redirige un canal activo al
   * dialplan en (context, exten, priority) y sale. El otro lado de la
   * llamada queda continuando la nueva ruta.
   * Usa AMI Redirect (más confiable que ARI continueInDialplan para
   * canales bridgeados).
   */
  async transferChannel(channelId: string, context: string, extension: string, priority = 1): Promise<{ success: boolean; output: string }> {
    if (!this.amiConnected || !this.amiClient) {
      return { success: false, output: 'AMI no conectado' };
    }
    return new Promise(resolve => {
      this.amiClient.action(
        { Action: 'Redirect', Channel: channelId, Context: context, Exten: extension, Priority: priority },
        (err: any, res: any) => {
          if (err) {
            resolve({ success: false, output: String(err?.message ?? err) });
          } else {
            resolve({ success: true, output: res?.message ?? 'Redirected' });
          }
        },
      );
    });
  }

  /**
   * Ejecuta un comando AMI arbitrario (Action: Command + Command: <cli>).
   * Útil para `pjsip reload`, `pjsip show endpoints`, etc.
   */
  async amiCommand(command: string): Promise<{ success: boolean; output: string }> {
    if (!this.amiConnected || !this.amiClient) {
      return { success: false, output: 'AMI no conectado' };
    }
    return new Promise(resolve => {
      this.amiClient.action(
        { Action: 'Command', Command: command },
        (err: any, res: any) => {
          if (err) {
            resolve({ success: false, output: String(err?.message ?? err) });
          } else {
            // La lib `asterisk-manager` puede devolver `output` como string O
            // como array de strings (una entrada por línea). Normalizamos a
            // string con saltos de línea reales para que los consumidores
            // (incluido el contador de endpoints) puedan parsear con split('\n').
            const raw = res?.output ?? res?.message ?? res;
            let output: string;
            if (Array.isArray(raw)) output = raw.join('\n');
            else if (typeof raw === 'string') output = raw;
            else output = JSON.stringify(raw);
            resolve({ success: true, output });
          }
        },
      );
    });
  }

  /** Lista PJSIP endpoints registrados (vía AMI). */
  async pjsipShowEndpoints(): Promise<string> {
    const r = await this.amiCommand('pjsip show endpoints');
    return r.output;
  }

  /**
   * Recarga la config de PJSIP sin reiniciar Asterisk.
   * Nota: el comando CLI `pjsip reload` NO existe en algunas builds de
   * Asterisk 18 (incluida `andrius/asterisk:18-current`). El correcto que
   * funciona consistentemente es `module reload res_pjsip.so`, que recarga
   * pjsip.conf y todos sus #include / #tryinclude.
   */
  async pjsipReload(): Promise<boolean> {
    const r = await this.amiCommand('module reload res_pjsip.so');
    return r.success;
  }

  /** Originar una llamada saliente desde un endpoint hacia un destino. */
  async originate(opts: {
    endpoint: string;
    extension?: string;
    context?: string;
    priority?: number;
    callerId?: string;
    timeout?: number;
    variables?: Record<string, string>;
  }): Promise<{ channelId: string }> {
    const ari = this.requireAri();
    const channel = await ari.channels.originate({
      endpoint: opts.endpoint,
      extension: opts.extension,
      context: opts.context ?? 'outbound',
      priority: opts.priority ?? 1,
      callerId: opts.callerId,
      timeout: opts.timeout ?? 30,
      variables: opts.variables ?? {},
    });
    return { channelId: channel.id };
  }
}
