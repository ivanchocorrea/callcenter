'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, unwrap } from '@/lib/api/client';
import { X, Copy, Check } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

interface UserOption {
  id: number;
  email: string;
  full_name: string;
}

export function AgentFormModal({ onClose, onSaved }: Props) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [extension, setExtension] = useState('');
  const [sipSecret, setSipSecret] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('');
  const [skillLevel, setSkillLevel] = useState('3');
  const [canBeRecorded, setCanBeRecorded] = useState(true);
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/users').then(res => setUsers(unwrap<UserOption[]>(res))).catch(() => setUsers([]));
    // generar secret y extensión sugeridos
    setSipSecret(generateSecret());
    setExtension(suggestExtension());
  }, []);

  function generateSecret() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function suggestExtension() {
    return String(1000 + Math.floor(Math.random() * 9000));
  }

  function copySecret() {
    navigator.clipboard.writeText(sipSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!userId) return setError('Selecciona un usuario');
    if (!extension || extension.length < 2) return setError('Extensión inválida');
    if (!sipSecret || sipSecret.length < 8) return setError('SIP secret inválido (mín. 8 caracteres)');
    if (!displayName || displayName.length < 2) return setError('Nombre del agente requerido');

    setSubmitting(true);
    try {
      const payload: any = {
        user_id: parseInt(userId, 10),
        extension,
        sip_secret: sipSecret,
        display_name: displayName,
        skill_level: parseInt(skillLevel, 10),
        can_be_recorded: canBeRecorded,
        auto_answer: autoAnswer,
      };
      if (department) payload.department = department;

      await api.post('/agents', payload);
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al crear agente';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-llenar nombre cuando se elige usuario
  useEffect(() => {
    if (userId && !displayName) {
      const u = users.find(x => x.id === parseInt(userId, 10));
      if (u) setDisplayName(u.full_name);
    }
  }, [userId, users, displayName]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Nuevo agente</h3>
            <p className="text-xs text-slate-500 mt-0.5">Convierte un usuario en agente con credenciales SIP/WebRTC.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Usuario <span className="text-rose-500">*</span></label>
            <select value={userId} onChange={e => setUserId(e.target.value)} required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none">
              <option value="">— Selecciona un usuario —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">El usuario debe existir antes. Crea uno desde Usuarios → Nuevo usuario.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del agente (display) <span className="text-rose-500">*</span></label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required
              placeholder="Ej. Iván — Soporte"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Extensión SIP <span className="text-rose-500">*</span></label>
              <input type="text" value={extension} onChange={e => setExtension(e.target.value)} required
                placeholder="1001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
              <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                placeholder="Soporte / Ventas / etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              SIP Secret (contraseña WebRTC) <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <input type="text" value={sipSecret} onChange={e => setSipSecret(e.target.value)} required
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
              <button type="button" onClick={() => setSipSecret(generateSecret())} className="px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg border border-brand-200">
                Regenerar
              </button>
              <button type="button" onClick={copySecret} className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-amber-600 mt-1">⚠️ Guarda este secret — necesario para configurar el softphone WebRTC.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nivel de skill (1-5)</label>
              <select value={skillLevel} onChange={e => setSkillLevel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="1">1 — Junior</option>
                <option value="2">2</option>
                <option value="3">3 — Estándar</option>
                <option value="4">4</option>
                <option value="5">5 — Senior</option>
              </select>
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={canBeRecorded} onChange={e => setCanBeRecorded(e.target.checked)} />
                Grabar llamadas
              </label>
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={autoAnswer} onChange={e => setAutoAnswer(e.target.checked)} />
                Auto-contestar
              </label>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSubmit as any} disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
            {submitting ? 'Creando…' : 'Crear agente'}
          </button>
        </div>
      </div>
    </div>
  );
}
