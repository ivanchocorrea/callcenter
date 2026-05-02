'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, unwrap } from '@/lib/api/client';
import { SipClient, SipClientEvent } from './sip-client';
import { useAuth } from '@/lib/auth/auth-context';

export type SipState = 'idle' | 'connecting' | 'registered' | 'unregistered' | 'failed';

interface IncomingCall {
  remoteUri: string;
  displayName: string | null;
  fromNumber: string;
}

interface ActiveCall {
  remoteUri: string;
  displayName: string | null;
  startedAt: Date;
  onHold: boolean;
  muted: boolean;
}

interface SipContextValue {
  state: SipState;
  error: string | null;
  incoming: IncomingCall | null;
  active: ActiveCall | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  dial: (number: string) => Promise<void>;
  answer: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleHold: () => Promise<void>;
  toggleMute: () => void;
  sendDtmf: (tones: string) => Promise<void>;
  /**
   * Marca que el agente acaba de iniciar una llamada saliente desde el dialer.
   * El próximo INVITE entrante (que es la otra pata del click-to-call) se
   * auto-contesta sin mostrar el popup "Contestar". Vence a los `ttlMs`.
   */
  markPendingOutbound: (ttlMs?: number) => void;
}

const SipCtx = createContext<SipContextValue | undefined>(undefined);

export function SipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const clientRef = useRef<SipClient | null>(null);
  // Timestamp hasta el cual el próximo INVITE entrante se auto-contesta
  // (porque es la otra pata de un click-to-call que el agente acaba de
  // iniciar). 0 = no hay pending outbound.
  const pendingOutboundUntilRef = useRef<number>(0);
  const [state, setState] = useState<SipState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);

  const onEvent = useCallback((e: SipClientEvent) => {
    if (e.type === 'registered') { setState('registered'); setError(null); }
    if (e.type === 'unregistered') setState('unregistered');
    if (e.type === 'failed') { setState('failed'); setError(e.reason); }
    if (e.type === 'incoming') {
      // Si el agente acaba de iniciar una llamada saliente desde el dialer,
      // el próximo INVITE entrante es la otra pata del click-to-call. Lo
      // contestamos automáticamente sin mostrar el popup "Contestar".
      if (Date.now() < pendingOutboundUntilRef.current) {
        pendingOutboundUntilRef.current = 0;  // consume el flag
        // Auto-answer del INVITE recién recibido
        clientRef.current?.answer().catch(err => {
          console.error('Auto-answer falló:', err);
        });
        // NO seteamos `incoming` para no mostrar el popup
        return;
      }
      setIncoming({
        remoteUri: e.remoteUri,
        displayName: e.displayName,
        fromNumber: extractNumber(e.remoteUri),
      });
    }
    if (e.type === 'connected') {
      setIncoming(null);
      setActive({
        remoteUri: extractNumber((e.session.remoteIdentity?.uri as any)?.toString?.() ?? ''),
        displayName: e.session.remoteIdentity?.displayName ?? null,
        startedAt: new Date(),
        onHold: false,
        muted: false,
      });
    }
    if (e.type === 'ended') {
      setActive(null);
      setIncoming(null);
    }
  }, []);

  const markPendingOutbound = useCallback((ttlMs = 15000) => {
    pendingOutboundUntilRef.current = Date.now() + ttlMs;
  }, []);

  const start = useCallback(async () => {
    if (!user) return;
    if (clientRef.current) return;
    setState('connecting');
    setError(null);
    try {
      const res = await api.get('/webrtc/credentials');
      const creds = unwrap<any>(res);
      const client = new SipClient({
        sipUri: creds.sip_uri,
        sipPassword: creds.sip_password,
        wssUrl: creds.wss_url,
        iceServers: creds.ice_servers as RTCIceServer[],
        displayName: user.full_name,
      });
      client.on(onEvent);
      clientRef.current = client;
      await client.start();
    } catch (err: any) {
      setState('failed');
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'No se pudo iniciar SIP');
    }
  }, [user, onEvent]);

  const stop = useCallback(async () => {
    await clientRef.current?.stop();
    clientRef.current = null;
    setState('idle');
    setActive(null);
    setIncoming(null);
  }, []);

  const dial = useCallback(async (number: string) => {
    if (!clientRef.current) await start();
    await clientRef.current?.dial(number);
  }, [start]);

  const answer = useCallback(async () => {
    await clientRef.current?.answer();
    setIncoming(null);
  }, []);

  const hangup = useCallback(async () => {
    await clientRef.current?.hangup();
  }, []);

  const toggleHold = useCallback(async () => {
    if (!active) return;
    const next = !active.onHold;
    await clientRef.current?.hold(next);
    setActive(a => (a ? { ...a, onHold: next } : a));
  }, [active]);

  const toggleMute = useCallback(() => {
    if (!active) return;
    const next = !active.muted;
    clientRef.current?.setMuted(next);
    setActive(a => (a ? { ...a, muted: next } : a));
  }, [active]);

  const sendDtmf = useCallback(async (tones: string) => {
    await clientRef.current?.sendDtmf(tones);
  }, []);

  // Cleanup en logout
  useEffect(() => {
    if (!user) {
      void stop();
    }
  }, [user, stop]);

  const value: SipContextValue = {
    state, error, incoming, active,
    start, stop, dial, answer, hangup, toggleHold, toggleMute, sendDtmf,
    markPendingOutbound,
  };
  return <SipCtx.Provider value={value}>{children}</SipCtx.Provider>;
}

export function useSip() {
  const ctx = useContext(SipCtx);
  if (!ctx) throw new Error('useSip debe usarse dentro de <SipProvider>');
  return ctx;
}

function extractNumber(uri: string): string {
  const m = /sip:([^@]+)@/.exec(uri);
  return m ? m[1] : uri;
}
