'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth/auth-context';
import { SipProvider } from '@/lib/webrtc/sip-context';
import { RealtimeProvider } from '@/lib/realtime/realtime-context';
import { DialogHost } from '@/lib/ui/dialog-helper';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RealtimeProvider>
          <SipProvider>
            {children}
            <DialogHost />
          </SipProvider>
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
