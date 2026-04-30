'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api/client';
import { X, Plus, Trash2, Zap } from 'lucide-react';

interface Props { onClose: () => void; onSaved: () => void; }

interface Action {
  action_type: 'send_sms' | 'create_callback' | 'send_webhook' | 'create_ticket' | 'tag_customer' | 'transfer_call' | 'send_email' | 'log_audit';
  config: Record<string, any>;
}

const TRIGGERS = [
  { v: 'co:event:call.ended', l: '📞 Llamada finalizada' },
  { v: 'co:event:call.abandoned', l: '😞 Llamada abandonada' },
  { v: 'co:event:call.missed', l: '❌ Llamada perdida' },
  { v: 'co:event:call.incoming', l: '📲 Llamada entrante' },
  { v: 'co:event:queue.timeout', l: '⏱️ Timeout en cola' },
  { v: 'co:event:agent.status_changed', l: '🎧 Agente cambió estado' },
  { v: 'co:event:recording.created', l: '🎙️ Grabación creada' },
  { v: 'co:event:webhook.received', l: '🔗 Webhook entrante' },
  { v: 'co:event:sms.received', l: '💬 SMS recibido' },
];

const ACTION_TYPES = [
  { v: 'send_sms', l: '💬 Enviar SMS', config: ['to_template', 'body_template'] },
  { v: 'create_callback', l: '📞 Crear callback', config: ['phone_template', 'queue_id'] },
  { v: 'send_webhook', l: '🔗 Enviar webhook', config: ['endpoint_id'] },
  { v: 'create_ticket', l: '🎫 Crear ticket', config: ['subject', 'priority'] },
  { v: 'tag_customer', l: '🏷️ Etiquetar cliente', config: ['tag'] },
  { v: 'transfer_call', l: '🔄 Transferir llamada', config: ['destination_type', 'destination_id'] },
  { v: 'send_email', l: '📧 Enviar email', config: ['to', 'subject', 'body'] },
  { v: 'log_audit', l: '📋 Registrar en audit', config: ['action'] },
];

export function AutomationFormModal({ onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState(TRIGGERS[0].v);
  const [conditions, setConditions] = useState<Array<{field_path: string; operator: string; value: string}>>([]);
  const [actions, setActions] = useState<Action[]>([{ action_type: 'send_sms', config: {} }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCondition() {
    setConditions([...conditions, { field_path: '', operator: '==', value: '' }]);
  }

  function removeCondition(i: number) {
    setConditions(conditions.filter((_, idx) => idx !== i));
  }

  function updateCondition(i: number, key: 'field_path'|'operator'|'value', val: string) {
    setConditions(conditions.map((c, idx) => idx === i ? { ...c, [key]: val } : c));
  }

  function addAction() {
    setActions([...actions, { action_type: 'send_sms', config: {} }]);
  }

  function removeAction(i: number) {
    setActions(actions.filter((_, idx) => idx !== i));
  }

  function updateActionType(i: number, t: Action['action_type']) {
    setActions(actions.map((a, idx) => idx === i ? { ...a, action_type: t, config: {} } : a));
  }

  function updateActionConfig(i: number, k: string, v: string) {
    setActions(actions.map((a, idx) => idx === i ? { ...a, config: { ...a.config, [k]: v } } : a));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) return setError('Nombre requerido');
    if (actions.length === 0) return setError('Al menos una acción requerida');

    setSubmitting(true);
    try {
      await api.post('/automations', {
        name,
        trigger_event: triggerEvent,
        conditions: conditions.filter(c => c.field_path),
        actions: actions.map(a => ({ action_type: a.action_type, config: a.config })),
        is_active: true,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al crear automatización';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" /> Nueva automatización
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Cuando ocurre X → Si cumple Y → Hacer Z</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-rose-500">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="Ej. SMS al perder llamada"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">1</span>
              <label className="text-sm font-medium text-slate-700">Cuando ocurre este evento (trigger)</label>
            </div>
            <select value={triggerEvent} onChange={e => setTriggerEvent(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              {TRIGGERS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">2</span>
                <label className="text-sm font-medium text-slate-700">Si cumple estas condiciones (opcional)</label>
              </div>
              <button type="button" onClick={addCondition} className="text-xs text-brand-600 hover:text-brand-700 font-medium">+ Condición</button>
            </div>
            {conditions.length === 0 ? (
              <p className="text-xs text-slate-500 italic px-3 py-2 bg-slate-50 rounded">Sin condiciones — la regla se ejecuta SIEMPRE que ocurra el trigger.</p>
            ) : (
              <div className="space-y-2">
                {conditions.map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input type="text" value={c.field_path} onChange={e => updateCondition(i, 'field_path', e.target.value)}
                      placeholder="duration / agent_id / from_number"
                      className="col-span-5 px-2 py-1.5 border border-slate-300 rounded text-xs font-mono" />
                    <select value={c.operator} onChange={e => updateCondition(i, 'operator', e.target.value)}
                      className="col-span-2 px-2 py-1.5 border border-slate-300 rounded text-xs">
                      <option value="==">==</option>
                      <option value="!=">!=</option>
                      <option value=">">{'>'}</option>
                      <option value="<">{'<'}</option>
                      <option value=">=">{'>='}</option>
                      <option value="<=">{'<='}</option>
                      <option value="contains">contiene</option>
                      <option value="startsWith">empieza con</option>
                    </select>
                    <input type="text" value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)}
                      placeholder="valor"
                      className="col-span-4 px-2 py-1.5 border border-slate-300 rounded text-xs" />
                    <button type="button" onClick={() => removeCondition(i)} className="col-span-1 text-rose-500 hover:bg-rose-50 rounded p-1">
                      <Trash2 className="w-3 h-3 mx-auto" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">3</span>
                <label className="text-sm font-medium text-slate-700">Hacer estas acciones</label>
              </div>
              <button type="button" onClick={addAction} className="text-xs text-brand-600 hover:text-brand-700 font-medium">+ Acción</button>
            </div>
            <div className="space-y-3">
              {actions.map((a, i) => {
                const def = ACTION_TYPES.find(x => x.v === a.action_type);
                return (
                  <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <select value={a.action_type} onChange={e => updateActionType(i, e.target.value as any)}
                        className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm">
                        {ACTION_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                      <button type="button" onClick={() => removeAction(i)} className="text-rose-500 hover:bg-rose-50 rounded p-1.5">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {def?.config.map(k => (
                      <input key={k} type="text" value={a.config[k] ?? ''} onChange={e => updateActionConfig(i, k, e.target.value)}
                        placeholder={k}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono" />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSubmit as any} disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
            {submitting ? 'Creando…' : 'Crear automatización'}
          </button>
        </div>
      </div>
    </div>
  );
}
