'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Headphones, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, needsTotp ? totp : undefined);
      router.push('/');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Error al iniciar sesión';
      if (typeof msg === 'string' && msg.toLowerCase().includes('2fa')) {
        setNeedsTotp(true);
        setError('Ingresa tu código de 6 dígitos (TOTP)');
      } else {
        setError(typeof msg === 'string' ? msg : 'Credenciales inválidas');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex">
      {/* Left: Hero */}
      <section className="hidden md:flex flex-1 bg-gradient-to-br from-brand-700 to-brand-950 text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/10"><Headphones className="w-7 h-7" /></div>
          <span className="text-xl font-semibold">Call Center NODOE</span>
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Centro de contacto profesional, multiempresa, con IA.
          </h1>
          <p className="text-brand-100/90 text-lg max-w-lg">
            Atiende llamadas desde el navegador, configura troncales SIP, IVR, colas con turnos y bots
            IA — todo desde un panel web.
          </p>
          <ul className="space-y-2 text-brand-100/80 text-sm">
            <li className="flex gap-2"><ShieldCheck className="w-5 h-5 text-emerald-300" /> Multi-tenant con aislamiento estricto</li>
            <li className="flex gap-2"><ShieldCheck className="w-5 h-5 text-emerald-300" /> Credenciales cifradas (AES-256-GCM)</li>
            <li className="flex gap-2"><ShieldCheck className="w-5 h-5 text-emerald-300" /> Webhooks firmados HMAC, auditoría completa</li>
          </ul>
        </div>
        <p className="text-xs text-brand-200/70">© {new Date().getFullYear()} NODOE. v0.1.0</p>
      </section>

      {/* Right: Form */}
      <section className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Iniciar sesión</h2>
            <p className="text-sm text-slate-500 mt-1">Accede con tu cuenta de empresa.</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="tu@empresa.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="••••••••"
              />
            </div>
            {needsTotp && (
              <div>
                <label className="text-sm font-medium text-slate-700">Código 2FA</label>
                <input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={totp}
                  onChange={e => setTotp(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 font-mono tracking-widest"
                  placeholder="123456"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2.5 transition"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            ¿Problemas para acceder? Contacta a tu administrador.
          </p>
        </form>
      </section>
    </main>
  );
}
