'use client';

import {
  Inviter,
  Invitation,
  Registerer,
  RegistererState,
  Session,
  SessionState,
  UserAgent,
  UserAgentOptions,
  URI,
} from 'sip.js';

export type SipClientEvent =
  | { type: 'registered' }
  | { type: 'unregistered' }
  | { type: 'incoming'; session: Session; remoteUri: string; displayName: string | null }
  | { type: 'connected'; session: Session }
  | { type: 'ended'; session: Session; cause?: string }
  | { type: 'failed'; reason: string };

export interface SipClientOptions {
  sipUri: string;
  sipPassword: string;
  wssUrl: string;
  iceServers: RTCIceServer[];
  displayName?: string;
  outputDeviceId?: string;
  inputDeviceId?: string;
}

/**
 * Wrapper sobre SIP.js para tener una API simple en React.
 * Maneja registro, llamadas entrantes/salientes, hold, mute y reproducción
 * del audio remoto.
 */
export class SipClient {
  private ua: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private currentSession: Session | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private listeners = new Set<(e: SipClientEvent) => void>();
  private opts: SipClientOptions;

  constructor(opts: SipClientOptions) {
    this.opts = opts;
  }

  on(handler: (e: SipClientEvent) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }
  private emit(e: SipClientEvent) {
    for (const h of this.listeners) try { h(e); } catch { /* ignore */ }
  }

  async start(): Promise<void> {
    if (this.ua) return;
    if (typeof window === 'undefined') throw new Error('SipClient solo en el navegador');

    this.remoteAudio = document.createElement('audio');
    this.remoteAudio.autoplay = true;
    document.body.appendChild(this.remoteAudio);

    const uri = UserAgent.makeURI(this.opts.sipUri);
    if (!uri) throw new Error('URI SIP inválido');

    const config: UserAgentOptions = {
      uri,
      authorizationUsername: uri.user ?? undefined,
      authorizationPassword: this.opts.sipPassword,
      displayName: this.opts.displayName,
      transportOptions: { server: this.opts.wssUrl },
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionConfiguration: { iceServers: this.opts.iceServers },
        constraints: {
          audio: this.opts.inputDeviceId
            ? { deviceId: { exact: this.opts.inputDeviceId } }
            : true,
          video: false,
        },
      },
      delegate: {
        onInvite: invitation => this.handleIncoming(invitation),
        onConnect: () => this.emit({ type: 'connected', session: this.currentSession as Session }),
        onDisconnect: err => this.emit({ type: 'failed', reason: err?.message ?? 'transport-disconnected' }),
      },
    };

    this.ua = new UserAgent(config);
    await this.ua.start();

    this.registerer = new Registerer(this.ua);
    this.registerer.stateChange.addListener(state => {
      if (state === RegistererState.Registered) this.emit({ type: 'registered' });
      if (state === RegistererState.Unregistered) this.emit({ type: 'unregistered' });
    });
    await this.registerer.register();
  }

  async stop(): Promise<void> {
    try { await this.registerer?.unregister(); } catch { /* ignore */ }
    try { await this.ua?.stop(); } catch { /* ignore */ }
    this.ua = null;
    this.registerer = null;
    if (this.remoteAudio) {
      this.remoteAudio.remove();
      this.remoteAudio = null;
    }
  }

  // --------- llamadas

  async dial(target: string): Promise<void> {
    if (!this.ua) throw new Error('SipClient no iniciado');
    const targetUri = UserAgent.makeURI(target.startsWith('sip:') ? target : `sip:${target}@${this.uaDomain()}`);
    if (!targetUri) throw new Error('Target inválido');
    const inviter = new Inviter(this.ua, targetUri);
    this.bindSession(inviter);
    await inviter.invite();
  }

  async answer(): Promise<void> {
    const s = this.currentSession;
    if (!s) return;
    if (!(s instanceof Invitation)) return;
    await s.accept({
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
      } as any,
    });
  }

  async hangup(): Promise<void> {
    const s = this.currentSession;
    if (!s) return;
    try {
      if (s instanceof Invitation && s.state === SessionState.Initial) {
        await s.reject();
      } else if (s.state === SessionState.Established) {
        await s.bye();
      } else {
        // @ts-ignore — Inviter cancel
        await s.cancel?.();
      }
    } catch { /* ignore */ }
  }

  async hold(hold: boolean): Promise<void> {
    const s = this.currentSession;
    if (!s || s.state !== SessionState.Established) return;
    const handler: any = s.sessionDescriptionHandler;
    if (!handler) return;
    handler.holdToggle = hold;
    await s.invite({
      sessionDescriptionHandlerModifiers: hold ? [holdModifier] : [],
    } as any);
  }

  setMuted(muted: boolean): void {
    const s = this.currentSession;
    const handler: any = s?.sessionDescriptionHandler;
    const pc: RTCPeerConnection | undefined = handler?.peerConnection;
    pc?.getSenders().forEach(sender => {
      if (sender.track && sender.track.kind === 'audio') sender.track.enabled = !muted;
    });
  }

  /** Cambia el volumen del audio remoto (0–1). */
  setRemoteVolume(volume01: number): void {
    if (this.remoteAudio) {
      this.remoteAudio.volume = Math.max(0, Math.min(1, volume01));
    }
  }

  /** Mute del audio remoto (toggle altavoz). Cuando es true: silencia
   *  todo audio del otro lado para el agente. */
  setRemoteMuted(muted: boolean): void {
    if (this.remoteAudio) {
      this.remoteAudio.muted = muted;
    }
  }

  async sendDtmf(tones: string): Promise<void> {
    const s = this.currentSession;
    const handler: any = s?.sessionDescriptionHandler;
    if (handler?.sendDtmf) handler.sendDtmf(tones);
  }

  // --------- internals

  private uaDomain(): string {
    const uri = UserAgent.makeURI(this.opts.sipUri);
    return uri?.host ?? 'localhost';
  }

  private handleIncoming(invitation: Invitation): void {
    this.bindSession(invitation);
    this.emit({
      type: 'incoming',
      session: invitation,
      remoteUri: invitation.remoteIdentity.uri.toString(),
      displayName: invitation.remoteIdentity.displayName ?? null,
    });
  }

  private bindSession(session: Session): void {
    this.currentSession = session;
    session.stateChange.addListener(state => {
      if (state === SessionState.Established) {
        this.attachRemoteAudio(session);
        this.emit({ type: 'connected', session });
      }
      if (state === SessionState.Terminated) {
        this.emit({ type: 'ended', session });
        if (this.currentSession === session) this.currentSession = null;
      }
    });
  }

  private attachRemoteAudio(session: Session): void {
    if (!this.remoteAudio) return;
    const handler: any = session.sessionDescriptionHandler;
    const pc: RTCPeerConnection = handler?.peerConnection;
    if (!pc) return;
    const remoteStream = new MediaStream();
    pc.getReceivers().forEach(r => {
      if (r.track) remoteStream.addTrack(r.track);
    });
    this.remoteAudio.srcObject = remoteStream;
    if (this.opts.outputDeviceId && (this.remoteAudio as any).setSinkId) {
      (this.remoteAudio as any).setSinkId(this.opts.outputDeviceId).catch(() => undefined);
    }
  }
}

// SDP modifier para hold (sendonly)
async function holdModifier(description: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
  if (description.sdp) {
    description.sdp = description.sdp.replace(/a=sendrecv/g, 'a=sendonly');
    description.sdp = description.sdp.replace(/a=recvonly/g, 'a=inactive');
  }
  return description;
}
