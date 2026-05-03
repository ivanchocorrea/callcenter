'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { MessageSquare, Send, Info } from 'lucide-react';

interface SmsLog {
  id: number;
  to_number: string;
  body: string;
  status: string;
  created_at: string;
}

export default function SmsPage() {
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  function reload() {
    setLoadingLogs(true);
    api.get('/sms/logs')
      .then(res => setLogs(unwrap<SmsLog[]>(res)))
      .catch(() => setLogs([]))
      .finally(() => setLoadingLogs(false));
  }
  useEffect(() => { reload(); }, []);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!to) return setError('Número destino requerido');
    if (!body) return setError('Mensaje requerido');

    setSending(true);
    try {
      await api.post('/sms/send', { to, body });
      setSuccess(`SMS enviado a ${to}`);
      setBody('');
      reload();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al enviar SMS';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">SMS</h2>
          <p className="text-slate-500 mt-1">Envía SMS y revisa el log de envíos.</p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3 text-sm">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-blue-800">
            <strong>¿Aún no configuraste un proveedor SMS?</strong>{' '}
            Andá a{' '}
            <a href="/admin/sms-providers" className="underline font-semibold hover:text-blue-900">/admin/sms-providers</a>{' '}
            y agregá Twilio, Plivo, MessageBird o un HTTP custom. Sin proveedor activo este formulario falla.
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Send className="w-5 h-5 text-brand-600" /> Enviar SMS de prueba
          </h3>
          <form onSubmit={handleSend} className="space-y-3">
            {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>}
            {success && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{success}</div>}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Destino (E.164)</label>
              <input type="tel" value={to} onChange={e => setTo(e.target.value)} required
                placeholder="+573001234567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mensaje (160 caracteres recomendados)</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} required rows={3} maxLength={500}
                placeholder="Hola, te escribimos desde..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <p className="text-xs text-slate-500 mt-1">{body.length} caracteres</p>
            </div>
            <button type="submit" disabled={sending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
              <Send className="w-4 h-4" /> {sending ? 'Enviando…' : 'Enviar SMS'}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Últimos envíos</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Destino</th>
                <th className="text-left px-4 py-3 font-medium">Mensaje</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingLogs && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {!loadingLogs && logs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500"><MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />Sin SMS enviados todavía.</td></tr>
              )}
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700 font-mono text-xs">{l.to_number}</td>
                  <td className="px-4 py-3 text-slate-700 truncate max-w-md">{l.body}</td>
                  <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{l.status}</span></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
