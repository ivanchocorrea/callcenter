'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, unwrap } from '@/lib/api/client';
import { X, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  trunkId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormData {
  name: string;
  host: string;
  port: number;
  username: string;
  auth_username?: string;
  password: string;
  domain?: string;
  caller_id?: string;
  transport: 'udp' | 'tcp' | 'tls';
  direction: 'inbound' | 'outbound' | 'both';
  codecs: string[];
  nat_enabled: boolean;
  ice_enabled: boolean;
  rewrite_contact: boolean;
  register_interval: number;
  keep_alive_interval: number;
  encrypted_communication: boolean;
  srtp_mode: 'disabled' | 'optional' | 'required';
  priority: number;
}

const DEFAULTS: FormData = {
  name: '',
  host: '',
  port: 5060,
  username: '',
  password: '',
  transport: 'udp',
  direction: 'both',
  codecs: ['opus', 'ulaw', 'alaw'],
  nat_enabled: true,
  ice_enabled: false,
  rewrite_contact: true,
  register_interval: 300,
  keep_alive_interval: 15,
  encrypted_communication: false,
  srtp_mode: 'disabled',
  priority: 100,
};

export function TrunkFormModal({ trunkId, onClose, onSaved }: Props) {
  const [data, setData] = useState<FormData>(DEFAULTS);
  const [advanced, setAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = trunkId != null;

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/sip-trunks/${trunkId}`).then(res => {
      const t = unwrap<any>(res);
      setData({
        name: t.name ?? '',
        host: t.host ?? '',
        port: t.port ?? 5060,
        username: t.username ?? '',
        auth_username: t.auth_username ?? '',
        password: '', // nunca se llena por seguridad; queda vacío para no cambiar
        domain: t.domain ?? '',
        caller_id: t.caller_id ?? '',
        transport: t.transport ?? 'udp',
        direction: t.direction ?? 'both',
        codecs: t.codecs ?? ['opus', 'ulaw', 'alaw'],
        nat_enabled: t.nat_enabled ?? true,
        ice_enabled: t.ice_enabled ?? false,
        rewrite_contact: t.rewrite_contact ?? true,
        register_interval: t.register_interval ?? 300,
        keep_alive_interval: t.keep_alive_interval ?? 15,
        encrypted_communication: t.encrypted_communication ?? false,
        srtp_mode: t.srtp_mode ?? 'disabled',
        priority: t.priority ?? 100,
      });
    });
  }, [trunkId, isEdit]);

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setData(prev => ({ ...prev, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = { ...data };
      if (isEdit && !payload.password) delete payload.password; // no actualizar si no cambia
      if (!payload.auth_username) delete payload.auth_username;
      if (!payload.domain) delete payload.domain;
      if (!payload.caller_id) delete payload.caller_id;

      if (isEdit) {
        await api.patch(`/sip-trunks/${trunkId}`, payload);
      } else {
        await api.post('/sip-trunks', payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-slate-900">{isEdit ? 'Editar troncal' : 'Nueva troncal SIP'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          {/* SIMPLE */}
          <div className="space-y-3">
            <Field label="Nombre *">
              <input
                value={data.name} onChange={e => set('name', e.target.value)}
                required className="input" placeholder="didww-bogota"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Servidor SIP *">
                  <input value={data.host} onChange={e => set('host', e.target.value)} required className="input" placeholder="sip.didww.com" />
                </Field>
              </div>
              <Field label="Puerto">
                <input
                  type="number" value={data.port}
                  onChange={e => set('port', parseInt(e.target.value, 10) || 5060)}
                  className="input"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Usuario *">
                <input value={data.username} onChange={e => set('username', e.target.value)} required className="input" />
              </Field>
              <Field label={isEdit ? 'Contraseña (deja vacío para conservar)' : 'Contraseña *'}>
                <input
                  type="password"
                  value={data.password}
                  onChange={e => set('password', e.target.value)}
                  required={!isEdit}
                  className="input"
                  autoComplete="new-password"
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Transport">
                <select value={data.transport} onChange={e => set('transport', e.target.value as any)} className="input">
                  <option value="udp">UDP</option>
                  <option value="tcp">TCP</option>
                  <option value="tls">TLS</option>
                </select>
              </Field>
              <Field label="Dirección">
                <select value={data.direction} onChange={e => set('direction', e.target.value as any)} className="input">
                  <option value="both">Inbound + Outbound</option>
                  <option value="inbound">Solo entrada</option>
                  <option value="outbound">Solo salida</option>
                </select>
              </Field>
              <Field label="Caller ID">
                <input value={data.caller_id ?? ''} onChange={e => set('caller_id', e.target.value)} className="input" placeholder="+57..." />
              </Field>
            </div>
          </div>

          {/* AVANZADO */}
          <button
            type="button"
            onClick={() => setAdvanced(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            {advanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Opciones avanzadas
          </button>

          {advanced && (
            <div className="space-y-3 border-t pt-4 border-slate-200">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Auth username">
                  <input value={data.auth_username ?? ''} onChange={e => set('auth_username', e.target.value)} className="input" />
                </Field>
                <Field label="Dominio">
                  <input value={data.domain ?? ''} onChange={e => set('domain', e.target.value)} className="input" />
                </Field>
              </div>
              <Field label="Códecs (separados por coma)">
                <input
                  value={data.codecs.join(',')}
                  onChange={e => set('codecs', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="input"
                  placeholder="opus,ulaw,alaw,g729"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Register interval (s)">
                  <input type="number" value={data.register_interval} onChange={e => set('register_interval', parseInt(e.target.value, 10))} className="input" />
                </Field>
                <Field label="Keep alive (s)">
                  <input type="number" value={data.keep_alive_interval} onChange={e => set('keep_alive_interval', parseInt(e.target.value, 10))} className="input" />
                </Field>
                <Field label="Prioridad (failover)">
                  <input type="number" value={data.priority} onChange={e => set('priority', parseInt(e.target.value, 10))} className="input" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Modo SRTP">
                  <select value={data.srtp_mode} onChange={e => set('srtp_mode', e.target.value as any)} className="input">
                    <option value="disabled">Desactivado</option>
                    <option value="optional">Opcional</option>
                    <option value="required">Obligatorio</option>
                  </select>
                </Field>
                <div className="flex items-end gap-3 text-sm">
                  <CheckBox label="NAT" v={data.nat_enabled} onChange={v => set('nat_enabled', v)} />
                  <CheckBox label="ICE" v={data.ice_enabled} onChange={v => set('ice_enabled', v)} />
                  <CheckBox label="Rewrite contact" v={data.rewrite_contact} onChange={v => set('rewrite_contact', v)} />
                </div>
              </div>
            </div>
          )}

          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-slate-100">Cancelar</button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium"
            >
              {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear troncal'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        :global(.input) {
          @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CheckBox({ label, v, onChange }: { label: string; v: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-slate-700">
      <input type="checkbox" checked={v} onChange={e => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  );
}
