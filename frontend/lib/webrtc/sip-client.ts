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
    this.stopRingback();
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
    // Iniciar ringback INMEDIATAMENTE (estamos dentro de un user gesture →
    // el AudioContext puede arrancar sin estar suspended). El state listener
    // tambien lo intentara pero a veces el estado Establishing no triggea
    // a tiempo y se pierde el sonido inicial.
    this.startRingback();
    try {
      await inviter.invite();
    } catch (err) {
      this.stopRingback();
      throw err;
    }
  }

  async answer(): Promise<void> {
    const s = this.currentSession;
    if (!s) {
      console.warn('[SipClient] answer() sin currentSession activa');
      return;
    }
    if (!(s instanceof Invitation)) {
      console.warn('[SipClient] answer() — session no es Invitation:', s.constructor?.name);
      return;
    }
    if (s.state !== SessionState.Initial && s.state !== SessionState.Establishing) {
      console.warn('[SipClient] answer() — session ya en estado:', s.state);
      return;
    }
    try {
      await s.accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        } as any,
      });
    } catch (err) {
      console.error('[SipClient] accept() falló:', err);
      throw err;
    }
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
    // Multiple safeguards para garantizar que el banner se limpie cuando
    // el caller cuelga sin que el agente conteste:
    //
    // 1) onCancel: para CANCELs antes de la respuesta (mas comun)
    // 2) onBye: para BYE post-respuesta
    // 3) onSessionDescriptionHandler/error: cualquier fallo
    //
    // Antes solo dependia del state listener que SIP.js a veces no
    // dispara consistentemente, dejando el banner+ringtone hasta F5.
    const cleanup = (cause: string) => {
      this.emit({ type: 'ended', session: invitation, cause });
      if (this.currentSession === invitation) this.currentSession = null;
    };
    invitation.delegate = {
      ...(invitation.delegate ?? {}),
      onCancel: () => cleanup('caller-cancelled'),
      onBye: () => cleanup('bye'),
    };
    // Listener adicional al stateChange — si pasa a Terminated emite ended
    // (el bindSession ya hace esto, pero por triple seguridad)
    invitation.stateChange.addListener(state => {
      if (state === SessionState.Terminated) cleanup('terminated');
    });
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
      if (state === SessionState.Establishing) {
        // Ringback local solo para llamadas SALIENTES (Inviter). En entrantes
        // (Invitation) ya hay un ringtone diferente en el banner del dialer.
        if (session instanceof Inviter) {
          this.startRingback();
        }
      }
      if (state === SessionState.Established) {
        this.stopRingback();
        this.attachRemoteAudio(session);
        this.emit({ type: 'connected', session });
      }
      if (state === SessionState.Terminated) {
        this.stopRingback();
        this.emit({ type: 'ended', session });
        if (this.currentSession === session) this.currentSession = null;
      }
    });
  }

  // ---------- ringback local (saliente)
  // Sin esto, cuando el agente marca afuera no oye ningun "tu-tu" mientras
  // espera que contesten — solo silencio, hasta que la otra persona dice
  // "alo". Reproducimos un beep dual (440+480Hz) cada 6s, cadencia US-style.

  private ringbackCtx: AudioContext | null = null;
  private ringbackStopped = true;
  private ringbackTimer: number | null = null;

  private startRingback(): void {
    if (this.ringbackCtx) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    let ctx: AudioContext;
    try {
      ctx = new AC();
      // Browsers (Chrome/Safari) crean el AudioContext en estado 'suspended'.
      // Si no hacemos resume(), nunca suena. Se debe llamar dentro de un
      // user gesture — en `dial()` si lo es, en bindSession listener tal vez no.
      ctx.resume().catch(() => undefined);
    } catch (e) {
      console.warn('[SipClient] No se pudo crear AudioContext para ringback:', e);
      return;
    }
    this.ringbackCtx = ctx;
    this.ringbackStopped = false;
    const beep = () => {
      if (this.ringbackStopped || !this.ringbackCtx) return;
      try {
        const ctx = this.ringbackCtx;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(480, ctx.currentTime);
        osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.9);
        osc1.start(); osc2.start();
        osc1.stop(ctx.currentTime + 2);
        osc2.stop(ctx.currentTime + 2);
      } catch (err) {
        console.warn('[SipClient] beep ringback fallo:', err);
      }
      this.ringbackTimer = window.setTimeout(beep, 4000); // 2s on / 4s off
    };
    beep();
  }

  private stopRingback(): void {
    this.ringbackStopped = true;
    if (this.ringbackTimer != null) {
      clearTimeout(this.ringbackTimer);
      this.ringbackTimer = null;
    }
    if (this.ringbackCtx) {
      this.ringbackCtx.close().catch(() => undefined);
      this.ringbackCtx = null;
    }
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
