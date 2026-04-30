'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    // Redirección por rol
    if (user.roles.includes('super_admin')) router.replace('/super-admin');
    else if (user.roles.includes('company_admin')) router.replace('/admin');
    else if (user.roles.includes('supervisor')) router.replace('/supervisor');
    else if (user.roles.includes('agent')) router.replace('/agent');
    else router.replace('/dashboard');
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      Cargando…
    </div>
  );
}
