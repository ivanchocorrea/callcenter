'use client';

/**
 * Dialog helper imperativo. Permite a CUALQUIER componente lanzar modales
 * bonitos sin tener que importar componentes ni manejar state local.
 *
 * Uso:
 *   import { confirmAsync, toastShow, promptAsync } from '@/lib/ui/dialog-helper';
 *
 *   const ok = await confirmAsync({ title: 'Eliminar?', message: '...', variant: 'danger' });
 *   if (!ok) return;
 *   try { ... toastShow('Listo', 'success'); } catch { toastShow('Error', 'danger'); }
 *
 * El componente <DialogHost/> debe montarse UNA vez en el layout root.
 */

import { ReactNode, useEffect, useState } from 'react';
import { ConfirmDialog, PromptDialog, Toast, DialogIcons } from '@/components/shared/Dialog';

type Variant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  variant?: Variant;
  confirmText?: string;
  cancelText?: string;
}

interface PromptOptions extends ConfirmOptions {
  label: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'number';
  defaultValue?: string;
  minLength?: number;
  helperText?: string;
}

interface ToastItem {
  id: number;
  msg: ReactNode;
  variant: Variant;
}

let _setConfirm: ((opts: (ConfirmOptions & { resolve: (v: boolean) => void }) | null) => void) | null = null;
let _setPrompt: ((opts: (PromptOptions & { resolve: (v: string | null) => void }) | null) => void) | null = null;
let _pushToast: ((msg: ReactNode, variant: Variant) => void) | null = null;

export function confirmAsync(opts: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    if (!_setConfirm) { console.warn('DialogHost no montado'); resolve(window.confirm(typeof opts.message === 'string' ? opts.message : opts.title)); return; }
    _setConfirm({ ...opts, resolve });
  });
}

export function promptAsync(opts: PromptOptions): Promise<string | null> {
  return new Promise(resolve => {
    if (!_setPrompt) { console.warn('DialogHost no montado'); resolve(window.prompt(opts.label, opts.defaultValue ?? '')); return; }
    _setPrompt({ ...opts, resolve });
  });
}

export function toastShow(msg: ReactNode, variant: Variant = 'info'): void {
  if (!_pushToast) { console.warn('DialogHost no montado'); alert(typeof msg === 'string' ? msg : '...'); return; }
  _pushToast(msg, variant);
}

export function DialogHost() {
  const [confirmOpts, setConfirmOpts] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [promptOpts, setPromptOpts] = useState<(PromptOptions & { resolve: (v: string | null) => void }) | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    _setConfirm = setConfirmOpts;
    _setPrompt = setPromptOpts;
    _pushToast = (msg, variant) => {
      const id = Date.now() + Math.random();
      setToasts(t => [...t, { id, msg, variant }]);
    };
    return () => { _setConfirm = null; _setPrompt = null; _pushToast = null; };
  }, []);

  function dismissToast(id: number) { setToasts(t => t.filter(x => x.id !== id)); }

  return (
    <>
      <ConfirmDialog
        open={confirmOpts !== null}
        title={confirmOpts?.title ?? ''}
        message={confirmOpts?.message ?? ''}
        variant={confirmOpts?.variant ?? 'info'}
        confirmText={confirmOpts?.confirmText ?? 'Confirmar'}
        cancelText={confirmOpts?.cancelText ?? 'Cancelar'}
        onConfirm={() => { confirmOpts?.resolve(true); setConfirmOpts(null); }}
        onCancel={() => { confirmOpts?.resolve(false); setConfirmOpts(null); }}
      />
      <PromptDialog
        open={promptOpts !== null}
        title={promptOpts?.title ?? ''}
        message={promptOpts?.message}
        label={promptOpts?.label ?? ''}
        placeholder={promptOpts?.placeholder}
        type={promptOpts?.type ?? 'text'}
        defaultValue={promptOpts?.defaultValue}
        minLength={promptOpts?.minLength}
        helperText={promptOpts?.helperText}
        confirmText={promptOpts?.confirmText ?? 'Guardar'}
        cancelText={promptOpts?.cancelText ?? 'Cancelar'}
        variant={promptOpts?.variant ?? 'info'}
        onSubmit={value => { promptOpts?.resolve(value); setPromptOpts(null); }}
        onCancel={() => { promptOpts?.resolve(null); setPromptOpts(null); }}
      />
      {/* Múltiples toasts apilados */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast open={true} message={t.msg} variant={t.variant} onClose={() => dismissToast(t.id)} />
          </div>
        ))}
      </div>
    </>
  );
}
