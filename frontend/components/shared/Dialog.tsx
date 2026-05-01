'use client';

import { ReactNode, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, KeyRound, Trash2, Lock, Unlock } from 'lucide-react';

type Variant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  variant?: Variant;
  confirmText?: string;
  cancelText?: string;
  icon?: ReactNode;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const VARIANT_STYLES: Record<Variant, { icon: ReactNode; btn: string; ring: string }> = {
  danger: {
    icon: <AlertTriangle className="w-6 h-6 text-rose-600" />,
    btn: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500',
    ring: 'bg-rose-100',
  },
  warning: {
    icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
    btn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    ring: 'bg-amber-100',
  },
  info: {
    icon: <Info className="w-6 h-6 text-blue-600" />,
    btn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    ring: 'bg-blue-100',
  },
  success: {
    icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
    btn: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
    ring: 'bg-emerald-100',
  },
};

export function ConfirmDialog({
  open, title, message, variant = 'info',
  confirmText = 'Confirmar', cancelText = 'Cancelar',
  icon, onConfirm, onCancel, loading = false,
}: ConfirmProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;
  const style = VARIANT_STYLES[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${style.ring}`}>
              {icon ?? style.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <div className="mt-1.5 text-sm text-slate-600 leading-relaxed">{message}</div>
            </div>
            <button
              onClick={onCancel}
              disabled={loading}
              className="shrink-0 p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t border-slate-100">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm focus:ring-2 focus:ring-offset-1 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${style.btn}`}
          >
            {loading ? 'Procesando…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PromptProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'number';
  defaultValue?: string;
  minLength?: number;
  helperText?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
  icon?: ReactNode;
  onSubmit: (value: string) => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function PromptDialog({
  open, title, message, label, placeholder, type = 'text',
  defaultValue = '', minLength, helperText,
  confirmText = 'Guardar', cancelText = 'Cancelar',
  variant = 'info', icon,
  onSubmit, onCancel, loading = false,
}: PromptProps) {
  const [value, setValue] = useState(defaultValue);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setValue(defaultValue); setTouched(false); }
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;
  const style = VARIANT_STYLES[variant];
  const tooShort = minLength != null && value.length < minLength;
  const showError = touched && tooShort;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (tooShort) return;
    void onSubmit(value);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${style.ring}`}>
              {icon ?? style.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              {message && <div className="mt-1.5 text-sm text-slate-600">{message}</div>}
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="shrink-0 p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-5">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">{label}</label>
            <input
              type={type}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder}
              autoFocus
              disabled={loading}
              className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 ${
                showError ? 'border-rose-300 focus:ring-rose-200' : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
              }`}
            />
            {helperText && !showError && <p className="mt-1.5 text-xs text-slate-500">{helperText}</p>}
            {showError && (
              <p className="mt-1.5 text-xs text-rose-600">
                Mínimo {minLength} caracteres ({value.length} actual)
              </p>
            )}
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="submit"
            disabled={loading || tooShort}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm focus:ring-2 focus:ring-offset-1 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${style.btn}`}
          >
            {loading ? 'Procesando…' : confirmText}
          </button>
        </div>
      </form>
    </div>
  );
}

interface ToastProps {
  open: boolean;
  message: ReactNode;
  variant?: Variant;
  onClose: () => void;
  durationMs?: number;
}

export function Toast({ open, message, variant = 'success', onClose, durationMs = 3500 }: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;
  const style = VARIANT_STYLES[variant];

  return (
    <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-start gap-3 bg-white rounded-xl border border-slate-200 shadow-lg p-4 min-w-[300px] max-w-md">
        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${style.ring}`}>
          {style.icon}
        </div>
        <div className="flex-1 text-sm text-slate-800 pt-1">{message}</div>
        <button onClick={onClose} className="shrink-0 p-1 rounded-md text-slate-400 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Iconos contextuales reutilizables
export const DialogIcons = {
  Trash: <Trash2 className="w-6 h-6 text-rose-600" />,
  Lock: <Lock className="w-6 h-6 text-amber-600" />,
  Unlock: <Unlock className="w-6 h-6 text-emerald-600" />,
  Key: <KeyRound className="w-6 h-6 text-amber-600" />,
};
