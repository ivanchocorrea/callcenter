'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, MessageCircle, Trash2, Copy, Check, Send, Eye, EyeOff } from 'lucide-react';

interface Account {
  id: number;
  slug: string;
  display_name: string;
  phone_number: string;
  phone_number_id: string;
  business_account_id: string | null;
  is_active: boolean;
}

interface Message {
  id: number;
  account_id: number;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  message_type: string;
  body: string | null;
  received_at: string | null;
  created_at: string;
}

export default function WhatsappPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [openSend, setOpenSend] = useState<Account | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([
      api.get('/whatsapp/accounts').then(r => unwrap<Account[]>(r)).catch(() => []),
      api.get('/whatsapp/messages?limit=50').then(r => unwrap<Message[]>(r)).catch(() => []),
    ]).then(([a, m]) => { setAccounts(a); setMessages(m); }).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); const i = setInterval(reload, 15000); return () => clearInterval(i); }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">WhatsApp Business</h2>
            <p className="text-slate-500 mt-1">Cuentas conectadas a Meta Cloud API + mensajes en tiempo real.</p>
          </div>
          <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Conectar cuenta
          </button>
        </div>

        {/* Cuentas */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-600" /> Cuentas conectadas ({accounts.length})
            </h3>
          </div>
          {loading && <div className="p-6 text-center text-slate-500">Cargando…</div>}
          {!loading && accounts.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p>No hay cuentas WhatsApp conectadas todavía.</p>
              <p className="text-xs text-slate-400 mt-2">Necesitas tu Phone Number ID + Access Token de Meta Business.</p>
            </div>
          )}
          {accounts.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Cuenta</th>
                  <th className="text-left px-4 py-2 font-medium">Número</th>
                  <th className="text-left px-4 py-2 font-medium">Phone ID</th>
                  <th className="text-left px-4 py-2 font-medium">Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{a.display_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{a.phone_number}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.phone_number_id}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {a.is_active ? 'activo' : 'inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setOpenSend(a)} className="text-brand-600 hover:text-brand-700 mr-3" title="Enviar mensaje">
                        <Send className="w-4 h-4" />
                      </button>
                      <button onClick={async () => {
                        if (confirm(`¿Desconectar ${a.display_name}?`)) {
                          await api.delete(`/whatsapp/accounts/${a.id}`);
                          reload();
                        }
                      }} className="text-slate-400 hover:text-rose-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Mensajes */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Últimos mensajes (auto-refresh 15s)</h3>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {messages.length === 0 ? (
              <p className="p-8 text-center text-slate-500 text-sm">Sin mensajes todavía. Configura una cuenta arriba y manda algo a tu número.</p>
            ) : messages.map(m => (
              <div key={m.id} className={`p-3 flex items-start gap-3 ${m.direction === 'inbound' ? 'bg-blue-50/50' : ''}`}>
                <div className={`text-2xl ${m.direction === 'inbound' ? '⬅️' : '➡️'}`}>
                  {m.direction === 'inbound' ? '⬅️' : '➡️'}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-500">
                    <code className="bg-slate-100 px-1 rounded">{m.from_number}</code> → <code className="bg-slate-100 px-1 rounded">{m.to_number}</code>
                    <span className="ml-2">{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-slate-900 mt-1">
                    <span className="text-xs text-slate-400 mr-2">[{m.message_type}]</span>
                    {m.body ?? <em className="text-slate-400">(sin texto)</em>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Guía */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <h4 className="font-semibold mb-2">📘 Cómo conectar tu WhatsApp Business</h4>
          <ol className="list-decimal pl-5 space-y-1 text-blue-800">
            <li>Ve a <a href="https://business.facebook.com" target="_blank" className="underline">Meta Business Suite</a> → WhatsApp Manager</li>
            <li>Configura una app + WABA + número de teléfono</li>
            <li>Copia tu <code className="bg-white px-1 rounded">Phone Number ID</code> y genera <code className="bg-white px-1 rounded">Access Token</code> (permanente recomendado)</li>
            <li>Aquí click en "Conectar cuenta" y pega esos datos</li>
            <li>Después en Meta dashboard configura el webhook con la URL que te mostramos</li>
            <li>Manda un mensaje de prueba a tu número y aparecerá abajo automáticamente</li>
          </ol>
        </div>
      </div>

      {openCreate && <AccountModal onClose={() => setOpenCreate(false)} onSaved={reload} />}
      {openSend && <SendModal account={openSend} onClose={() => setOpenSend(null)} onSent={reload} />}
    </AppShell>
  );
}

function AccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [verifyToken, setVerifyToken] = useState(generateToken());
  const [webhookSecret, setWebhookSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generateToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post('/whatsapp/accounts', {
        slug, display_name: displayName, phone_number: phoneNumber, phone_number_id: phoneNumberId,
        business_account_id: businessAccountId || undefined,
        access_token: accessToken,
        verify_token: verifyToken,
        webhook_secret: webhookSecret || undefined,
      });
      const data = unwrap<{ id: number; webhook_url: string }>(res);
      setWebhookUrl(`https://api.somoscallcenter.com${data.webhook_url}`);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  }

  function copyUrl() {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Conectar WhatsApp Business</h3>
          <button onClick={onClose}>✕</button>
        </div>
        {webhookUrl ? (
          <div className="p-6 space-y-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
              <p className="font-medium text-emerald-900">✅ Cuenta creada</p>
              <p className="text-sm text-emerald-800 mt-1">Ahora configura el webhook en Meta Business:</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Webhook URL (pégala en Meta)</label>
                <div className="flex gap-2">
                  <input value={webhookUrl} readOnly className="flex-1 px-3 py-2 border rounded text-sm font-mono bg-slate-50" />
                  <button onClick={copyUrl} className="px-3 py-2 rounded bg-slate-100 hover:bg-slate-200 text-sm">
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Verify Token (también pégalo en Meta)</label>
                <input value={verifyToken} readOnly className="w-full px-3 py-2 border rounded text-sm font-mono bg-slate-50" />
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <strong>Pasos en Meta:</strong> WhatsApp → Configuration → Webhooks → Edit → pega URL + Verify Token → Verify and Save → suscríbete a "messages"
              </div>
              <button onClick={() => { onSaved(); onClose(); }} className="w-full px-4 py-2 rounded bg-brand-600 text-white text-sm font-medium">
                Listo, cerrar
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={save} className="px-6 py-5 space-y-4">
              {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre interno</label>
                  <input value={displayName} onChange={e => { setDisplayName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')); }} required
                    placeholder="Soporte WA" className="w-full px-3 py-2 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Slug</label>
                  <input value={slug} onChange={e => setSlug(e.target.value)} required className="w-full px-3 py-2 border rounded text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Número de teléfono (E.164)</label>
                <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} required placeholder="+57300..."
                  className="w-full px-3 py-2 border rounded text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone Number ID (Meta)</label>
                <input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} required placeholder="1234567890123456"
                  className="w-full px-3 py-2 border rounded text-sm font-mono" />
                <p className="text-xs text-slate-500 mt-1">Lo encuentras en WhatsApp Manager → API Setup</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Business Account ID (WABA, opcional)</label>
                <input value={businessAccountId} onChange={e => setBusinessAccountId(e.target.value)} placeholder="123456789012345"
                  className="w-full px-3 py-2 border rounded text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Access Token (System User Token, permanente)</label>
                <div className="relative">
                  <input type={showToken ? 'text' : 'password'} value={accessToken} onChange={e => setAccessToken(e.target.value)} required
                    placeholder="EAAxxx..."
                    className="w-full px-3 py-2 pr-10 border rounded text-sm font-mono" />
                  <button type="button" onClick={() => setShowToken(s => !s)} className="absolute right-2 top-2 text-slate-400">
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Se guarda cifrado AES-256-GCM. Recomendamos token permanente.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Verify Token (auto-generado)</label>
                <input value={verifyToken} onChange={e => setVerifyToken(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm font-mono" />
                <p className="text-xs text-slate-500 mt-1">Pégalo IGUAL en el campo "Verify Token" de Meta cuando configures webhook.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Webhook Secret (opcional, recomendado)</label>
                <input value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)}
                  placeholder="Para validar firma HMAC SHA256"
                  className="w-full px-3 py-2 border rounded text-sm font-mono" />
              </div>
            </form>
            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-slate-50 sticky bottom-0">
              <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm">Cancelar</button>
              <button onClick={save as any} disabled={submitting} className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
                {submitting ? 'Guardando…' : 'Conectar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SendModal({ account, onClose, onSent }: { account: Account; onClose: () => void; onSent: () => void }) {
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    setSubmitting(true);
    try {
      const res = await api.post(`/whatsapp/accounts/${account.id}/send`, { to, text });
      const data = unwrap<{ messageId: string }>(res);
      setSuccess(`Mensaje enviado: ${data.messageId}`);
      setText('');
      onSent();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al enviar');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Enviar WhatsApp desde {account.display_name}</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <form onSubmit={send} className="px-6 py-5 space-y-3">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{success}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Destino (E.164)</label>
            <input value={to} onChange={e => setTo(e.target.value)} required placeholder="+57300..."
              className="w-full px-3 py-2 border rounded text-sm font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mensaje</label>
            <textarea value={text} onChange={e => setText(e.target.value)} required rows={4}
              placeholder="Hola, te escribo desde..."
              className="w-full px-3 py-2 border rounded text-sm" />
          </div>
        </form>
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm">Cerrar</button>
          <button onClick={send as any} disabled={submitting} className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
            <Send className="w-4 h-4 inline mr-1" /> {submitting ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
