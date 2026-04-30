'use client';

import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/lib/auth/auth-context';
import { tokens } from '@/lib/api/client';

type Listener = (payload: any) => void;

interface RealtimeContextValue {
  connected: boolean;
  on: (event: string, handler: Listener) => () => void;
  emit: (event: string, payload?: unknown) => void;
}

const Ctx = createContext<RealtimeContextValue | undefined>(undefined);

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }
    const token = tokens.getAccess();
    if (!token) return;

    const socket = io(`${WS_URL}/realtime`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const on = (event: string, handler: Listener) => {
    const s = socketRef.current;
    if (!s) return () => undefined;
    s.on(event, handler);
    return () => s.off(event, handler);
  };
  const emit = (event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload);
  };

  return <Ctx.Provider value={{ connected, on, emit }}>{children}</Ctx.Provider>;
}

export function useRealtime() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRealtime debe usarse dentro de <RealtimeProvider>');
  return ctx;
}
